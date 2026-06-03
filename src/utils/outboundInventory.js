import pool from '../config/db.js';
import AppError from './AppError.js';
import { parseUuid } from './validate.js';

const OPEN_OUTBOUND_STATUSES = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'RESERVED',
  'PICKING',
  'PACKING',
];

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

/**
 * Sum requested qty on all open outbound lines for tenant + warehouse + SKU.
 */
export async function sumCommittedOutboundQuantity(
  tenantId,
  warehouseId,
  skuId,
  { excludeOutboundRequestItemId = null } = {}
) {
  const tenantUuid = parseUuid(tenantId, 'tenantId');
  const warehouseUuid = parseUuid(warehouseId, 'warehouseId');
  const skuUuid = parseUuid(skuId, 'skuId');

  const values = [tenantUuid, warehouseUuid, skuUuid];
  let excludeClause = '';
  if (excludeOutboundRequestItemId) {
    values.push(parseUuid(excludeOutboundRequestItemId, 'outboundRequestItemId'));
    excludeClause = ` AND oi.outbound_request_item_id <> $${values.length}`;
  }

  const statusList = OPEN_OUTBOUND_STATUSES.map((s) => `'${s}'`).join(', ');

  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(oi.requested_quantity), 0)::int AS qty
     FROM outbound_request_items oi
     INNER JOIN outbound_requests o ON o.outbound_request_id = oi.outbound_request_id
     WHERE o.tenant_id = $1
       AND o.warehouse_id = $2
       AND oi.sku_id = $3
       AND o.status IN (${statusList})
       ${excludeClause}`,
    values
  );

  return Number(rows[0]?.qty ?? 0);
}

export async function assertSufficientInventory({
  tenantId,
  warehouseId,
  skuId,
  requestedQuantity,
  excludeOutboundRequestItemId = null,
}) {
  const available = await sumAvailableInventoryForSku(tenantId, skuId, warehouseId);
  const alreadyCommitted = await sumCommittedOutboundQuantity(tenantId, warehouseId, skuId, {
    excludeOutboundRequestItemId,
  });
  const totalRequested = alreadyCommitted + requestedQuantity;

  if (totalRequested > available) {
    throw new AppError(
      `Insufficient inventory for SKU (available: ${available}, requested: ${totalRequested}, already committed on other outbound lines: ${alreadyCommitted})`,
      400,
      'INSUFFICIENT_INVENTORY'
    );
  }
}
