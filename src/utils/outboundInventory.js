import pool from '../config/db.js';
import AppError from './AppError.js';
import { parseUuid } from './validate.js';

/**
 * Sum available_quantity for a SKU in a warehouse (tenant-scoped, status AVAILABLE).
 */
export async function sumAvailableInventoryForSku(tenantId, skuId, warehouseId) {
  const tenantUuid = parseUuid(tenantId, 'tenantId');
  const skuUuid = parseUuid(skuId, 'skuId');
  const warehouseUuid = parseUuid(warehouseId, 'warehouseId');

  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(i.available_quantity), 0)::int AS available
     FROM inventories i
     INNER JOIN bins b ON b.bin_id = i.bin_id
     INNER JOIN rack_levels rl ON rl.rack_level_id = b.rack_level_id
     INNER JOIN racks r ON r.rack_id = rl.rack_id
     INNER JOIN warehouse_zones z ON z.zone_id = r.zone_id
     WHERE i.tenant_id = $1
       AND i.sku_id = $2
       AND z.warehouse_id = $3
       AND i.status = 'AVAILABLE'`,
    [tenantUuid, skuUuid, warehouseUuid]
  );

  return Number(rows[0]?.available ?? 0);
}

export async function assertSufficientInventory({
  tenantId,
  warehouseId,
  skuId,
  requestedQuantity,
  outboundRequestId = null,
  excludeOutboundRequestItemId = null,
}) {
  const available = await sumAvailableInventoryForSku(tenantId, skuId, warehouseId);

  let otherOutboundReserved = 0;
  if (outboundRequestId) {
    const outboundUuid = parseUuid(outboundRequestId, 'outboundRequestId');
    const values = [outboundUuid, skuId];
    let excludeClause = '';
    if (excludeOutboundRequestItemId) {
      values.push(parseUuid(excludeOutboundRequestItemId, 'outboundRequestItemId'));
      excludeClause = ` AND oi.outbound_request_item_id <> $${values.length}`;
    }
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(oi.requested_quantity), 0)::int AS qty
       FROM outbound_request_items oi
       INNER JOIN outbound_requests o ON o.outbound_request_id = oi.outbound_request_id
       WHERE oi.outbound_request_id = $1
         AND oi.sku_id = $2
         AND o.status IN ('DRAFT', 'PENDING', 'APPROVED', 'RESERVED', 'PICKING', 'PACKING')
         ${excludeClause}`,
      values
    );
    otherOutboundReserved = Number(rows[0]?.qty ?? 0);
  }

  const effectiveAvailable = available;
  const totalRequestedOnOutbound = otherOutboundReserved + requestedQuantity;

  if (totalRequestedOnOutbound > effectiveAvailable) {
    throw new AppError(
      `Insufficient inventory for SKU (available: ${effectiveAvailable}, requested: ${totalRequestedOnOutbound})`,
      400,
      'INSUFFICIENT_INVENTORY'
    );
  }
}
