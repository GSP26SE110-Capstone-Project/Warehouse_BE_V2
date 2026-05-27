import pool from '../config/db.js';
import Inventory from '../models/Inventory.js';
import InventoryMovement from '../models/InventoryMovement.js';
import Bin from '../models/Bin.js';
import AppError from '../utils/AppError.js';
import { INVENTORY_STATUS } from '../constants/inventory.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { getTenantCompany } from './tenantCompany.service.js';
import { getSku } from './sku.service.js';

function mapInventoryRow(row) {
  if (!row) return null;
  return {
    inventoryId: row.inventory_id ?? row.inventoryId,
    tenantId: row.tenant_id ?? row.tenantId,
    skuId: row.sku_id ?? row.skuId,
    batchId: row.batch_id ?? row.batchId,
    lpnId: row.lpn_id ?? row.lpnId,
    binId: row.bin_id ?? row.binId,
    quantity: row.quantity,
    reservedQuantity: row.reserved_quantity ?? row.reservedQuantity,
    availableQuantity: row.available_quantity ?? row.availableQuantity,
    status: row.status,
    receivedAt: row.received_at ?? row.receivedAt,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    sku: row.sku_code
      ? {
          skuId: row.sku_id,
          skuCode: row.sku_code,
          productName: row.product_name,
        }
      : undefined,
    lpnCode: row.lpn_code,
    binCode: row.bin_code,
    batchCode: row.batch_code,
  };
}

export async function getInventory(inventoryId) {
  const id = parseUuid(inventoryId, 'inventoryId');
  const row = await Inventory.findById(id);
  if (!row) {
    throw new AppError('Inventory not found', 404, 'NOT_FOUND');
  }
  return row;
}

export async function getInventoryWithContext(inventoryId) {
  const id = parseUuid(inventoryId, 'inventoryId');
  const result = await pool.query(
    `SELECT i.*, s.sku_code, s.product_name, l.lpn_code, b.bin_code
     FROM inventories i
     INNER JOIN skus s ON s.sku_id = i.sku_id
     INNER JOIN lpns l ON l.lpn_id = i.lpn_id
     INNER JOIN bins b ON b.bin_id = i.bin_id
     WHERE i.inventory_id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    throw new AppError('Inventory not found', 404, 'NOT_FOUND');
  }
  return mapInventoryRow(result.rows[0]);
}

export async function listInventories({
  tenantId,
  skuId,
  batchId,
  lpnId,
  binId,
  inboundRequestId,
  warehouseId,
  status,
  page,
  limit,
  offset,
}) {
  if (status) assertEnum(status, INVENTORY_STATUS, 'status');

  const conditions = [];
  const values = [];
  let idx = 1;

  if (tenantId) {
    conditions.push(`i.tenant_id = $${idx++}`);
    values.push(parseUuid(tenantId, 'tenantId'));
    await getTenantCompany(values[values.length - 1]);
  }
  if (skuId) {
    conditions.push(`i.sku_id = $${idx++}`);
    values.push(parseUuid(skuId, 'skuId'));
  }
  if (batchId) {
    conditions.push(`i.batch_id = $${idx++}`);
    values.push(parseUuid(batchId, 'batchId'));
  }
  if (lpnId) {
    conditions.push(`i.lpn_id = $${idx++}`);
    values.push(parseUuid(lpnId, 'lpnId'));
  }
  if (binId) {
    conditions.push(`i.bin_id = $${idx++}`);
    values.push(parseUuid(binId, 'binId'));
  }
  if (status) {
    conditions.push(`i.status = $${idx++}`);
    values.push(status);
  }
  if (inboundRequestId) {
    conditions.push(
      `i.batch_id IN (SELECT batch_id FROM batches WHERE inbound_request_id = $${idx++})`
    );
    values.push(parseUuid(inboundRequestId, 'inboundRequestId'));
  }
  if (warehouseId) {
    conditions.push(`EXISTS (
      SELECT 1 FROM bins bx
      INNER JOIN rack_levels rl ON rl.rack_level_id = bx.rack_level_id
      INNER JOIN racks r ON r.rack_id = rl.rack_id
      INNER JOIN warehouse_zones z ON z.zone_id = r.zone_id
      WHERE bx.bin_id = i.bin_id AND z.warehouse_id = $${idx++}
    )`);
    values.push(parseUuid(warehouseId, 'warehouseId'));
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM inventories i ${where}`,
    values
  );
  const total = countResult.rows[0].count;

  const listValues = [...values, limit, offset];
  const rowsResult = await pool.query(
    `SELECT i.*, s.sku_code, s.product_name, l.lpn_code, b.bin_code, bat.batch_code
     FROM inventories i
     INNER JOIN skus s ON s.sku_id = i.sku_id
     INNER JOIN lpns l ON l.lpn_id = i.lpn_id
     INNER JOIN bins b ON b.bin_id = i.bin_id
     INNER JOIN batches bat ON bat.batch_id = i.batch_id
     ${where}
     ORDER BY i.received_at DESC NULLS LAST, i.created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    listValues
  );

  return {
    items: rowsResult.rows.map(mapInventoryRow),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}

export async function listInventoryMovements(inventoryId, { page, limit, offset }) {
  const invId = parseUuid(inventoryId, 'inventoryId');
  await getInventory(invId);

  const [items, total] = await Promise.all([
    InventoryMovement.findAll(
      { inventoryId: invId },
      { orderBy: 'moved_at DESC', limit, offset }
    ),
    InventoryMovement.count({ inventoryId: invId }),
  ]);

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}

export async function assertNoInventoryForLpn(lpnId, client) {
  const count = await Inventory.count({ lpnId }, client);
  if (count > 0) {
    throw new AppError('LPN already has inventory records (already put away)', 400, 'LPN_ALREADY_PUTAWAY');
  }
}

export async function applyBinPutaway(bin, volumeUnits, client) {
  if (bin.status === 'BLOCKED') {
    throw new AppError('Bin is blocked', 400, 'BIN_BLOCKED');
  }

  const used = Number(bin.usedVolumeUnits ?? 0) + Number(volumeUnits);
  const lpnCount = Number(bin.currentLpnCount ?? 0) + 1;

  if (used > Number(bin.maxVolumeUnits)) {
    throw new AppError('Bin volume capacity exceeded', 400, 'BIN_CAPACITY_EXCEEDED');
  }
  if (lpnCount > Number(bin.maxLpnCount)) {
    throw new AppError('Bin LPN count capacity exceeded', 400, 'BIN_CAPACITY_EXCEEDED');
  }

  let status = bin.status;
  if (status !== 'RESERVED') {
    if (used >= bin.maxVolumeUnits || lpnCount >= bin.maxLpnCount) {
      status = 'FULL';
    } else if (used > 0 || lpnCount > 0) {
      status = 'PARTIAL';
    }
  }

  return Bin.updateById(
    bin.binId,
    {
      usedVolumeUnits: used,
      currentLpnCount: lpnCount,
      status,
    },
    client
  );
}

export async function createPutawayInventoryRecords(
  {
    tenantId,
    batchId,
    lpnId,
    binId,
    receivedAt,
    details,
    movedBy,
    lpnCode,
  },
  client
) {
  const created = [];

  for (const detail of details) {
    await getSku(detail.skuId);

    const inventory = await Inventory.create(
      {
        tenantId,
        skuId: detail.skuId,
        batchId,
        lpnId,
        binId,
        quantity: detail.quantity,
        reservedQuantity: 0,
        availableQuantity: detail.quantity,
        status: 'AVAILABLE',
        receivedAt: receivedAt ?? new Date(),
      },
      client
    );

    const movement = await InventoryMovement.create(
      {
        inventoryId: inventory.inventoryId,
        movementType: 'PUTAWAY',
        fromBinId: null,
        toBinId: binId,
        quantity: detail.quantity,
        movedBy: movedBy ?? undefined,
        movedAt: new Date(),
        note: `Putaway LPN ${lpnCode}`,
      },
      client
    );

    created.push({ inventory, movement });
  }

  return created;
}
