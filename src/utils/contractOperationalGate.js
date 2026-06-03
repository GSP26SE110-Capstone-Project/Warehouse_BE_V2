import pool from '../config/db.js';
import AppError from './AppError.js';
import { parseUuid } from './validate.js';

/** HĐ đã có ít nhất một phiếu nhập kho hoàn tất. */
export async function contractHasCompletedInbound(contractId) {
  const id = parseUuid(contractId, 'contractId');
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM inbound_requests
       WHERE contract_id = $1 AND status = 'COMPLETED'
     ) AS ok`,
    [id]
  );
  return Boolean(rows[0]?.ok);
}

/** Tồn AVAILABLE của tenant trong một kho (qua bin → zone → warehouse). */
export async function sumTenantWarehouseInventoryRemainder(tenantId, warehouseId) {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(i.quantity), 0)::int AS total_quantity,
       COALESCE(SUM(i.available_quantity), 0)::int AS available_quantity,
       COALESCE(SUM(i.reserved_quantity), 0)::int AS reserved_quantity,
       COUNT(DISTINCT CASE WHEN i.quantity > 0 THEN i.sku_id END)::int AS sku_count
     FROM inventories i
     INNER JOIN bins b ON b.bin_id = i.bin_id
     INNER JOIN rack_levels rl ON rl.rack_level_id = b.rack_level_id
     INNER JOIN racks r ON r.rack_id = rl.rack_id
     INNER JOIN warehouse_zones z ON z.zone_id = r.zone_id
     WHERE i.tenant_id = $1
       AND z.warehouse_id = $2
       AND i.status = 'AVAILABLE'
       AND i.quantity > 0`,
    [parseUuid(tenantId, 'tenantId'), parseUuid(warehouseId, 'warehouseId')]
  );
  const row = rows[0] ?? {};
  return {
    totalQuantity: Number(row.total_quantity ?? 0),
    availableQuantity: Number(row.available_quantity ?? 0),
    reservedQuantity: Number(row.reserved_quantity ?? 0),
    skuCount: Number(row.sku_count ?? 0),
  };
}

/**
 * Điều kiện tạo phiếu xuất: ≥1 inbound COMPLETED trên HĐ + còn tồn khả dụng trong kho.
 */
export async function assertOutboundOperationalGate(contractId, tenantId, warehouseId) {
  const hasCompleted = await contractHasCompletedInbound(contractId);
  if (!hasCompleted) {
    throw new AppError(
      'Chưa thể tạo phiếu xuất: hợp đồng chưa có phiếu nhập kho đã hoàn tất (trạng thái COMPLETED).',
      400,
      'OUTBOUND_NO_COMPLETED_INBOUND'
    );
  }

  const stock = await sumTenantWarehouseInventoryRemainder(tenantId, warehouseId);
  if (stock.availableQuantity <= 0) {
    throw new AppError(
      'Chưa thể tạo phiếu xuất: không còn hàng khả dụng trong kho (tồn khả dụng = 0). Hoàn tất nhập kho và putaway trước.',
      400,
      'OUTBOUND_NO_INVENTORY'
    );
  }

  return stock;
}
