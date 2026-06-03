import pool from '../config/db.js';
import AppError from '../utils/AppError.js';
import { BARCODE_ENTITY } from '../constants/barcode.js';
import { WAREHOUSE_ROLES as WH_ROLES } from '../constants/auth.js';
import {
  parseScanValue,
  barcodeLabelResponse,
  normalizeScanValue,
} from '../utils/barcodePayload.js';
import { assertWarehouseAccess, getScopedWarehouseId } from '../utils/warehouseAccess.js';
import { assertInboundReadable } from '../utils/inboundAccess.js';
import { getOutboundRequest } from './outboundRequest.service.js';
import { getBatch } from './batch.service.js';
import { getInboundRequest } from './inboundRequest.service.js';
import { getLpn } from './lpn.service.js';
import { getSku } from './sku.service.js';
import { parseUuid } from '../utils/validate.js';

function resolveWarehouseId(actor, queryWarehouseId) {
  if (actor?.role === 'SYSTEM_ADMIN') {
    return queryWarehouseId ? parseUuid(queryWarehouseId, 'warehouseId') : null;
  }
  const scoped = getScopedWarehouseId(actor);
  if (!scoped) {
    throw new AppError('Warehouse scope required for scan', 403, 'FORBIDDEN');
  }
  if (queryWarehouseId && queryWarehouseId !== scoped) {
    assertWarehouseAccess(actor, queryWarehouseId);
  }
  return scoped;
}

function assertScanRole(actor) {
  if (!actor) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
  if (actor.role === 'SYSTEM_ADMIN') return;
  if (WH_ROLES.includes(actor.role)) return;
  throw new AppError('WH staff roles only', 403, 'FORBIDDEN');
}

async function findInboundByCode(code, warehouseId) {
  const params = [code];
  let whClause = '';
  if (warehouseId) {
    params.push(warehouseId);
    whClause = ' AND ir.warehouse_id = $2';
  }
  const { rows } = await pool.query(
    `SELECT ir.inbound_request_id AS id
     FROM inbound_requests ir
     WHERE ir.inbound_code = $1${whClause}
     LIMIT 2`,
    params
  );
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw new AppError('Ambiguous inbound code — specify warehouse', 409, 'AMBIGUOUS_SCAN');
  }
  return rows[0].id;
}

async function findOutboundByCode(code, warehouseId) {
  const params = [code];
  let whClause = '';
  if (warehouseId) {
    params.push(warehouseId);
    whClause = ' AND orq.warehouse_id = $2';
  }
  const { rows } = await pool.query(
    `SELECT orq.outbound_request_id AS id
     FROM outbound_requests orq
     WHERE orq.outbound_code = $1${whClause}
     LIMIT 2`,
    params
  );
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw new AppError('Ambiguous outbound code — specify warehouse', 409, 'AMBIGUOUS_SCAN');
  }
  return rows[0].id;
}

async function findLpnByCode(code, warehouseId) {
  if (!warehouseId) {
    throw new AppError('warehouseId required to resolve LPN', 400, 'VALIDATION_ERROR');
  }
  const { rows } = await pool.query(
    `SELECT l.lpn_id AS id
     FROM lpns l
     INNER JOIN batches bat ON bat.batch_id = l.batch_id
     INNER JOIN inbound_requests ir ON ir.inbound_request_id = bat.inbound_request_id
     WHERE l.lpn_code = $1 AND ir.warehouse_id = $2
     LIMIT 2`,
    [code, warehouseId]
  );
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw new AppError('Ambiguous LPN code in warehouse', 409, 'AMBIGUOUS_SCAN');
  }
  return rows[0].id;
}

async function findBatchByCode(code, warehouseId) {
  const params = [code];
  let whClause = '';
  if (warehouseId) {
    params.push(warehouseId);
    whClause = ' AND ir.warehouse_id = $2';
  }
  const { rows } = await pool.query(
    `SELECT bat.batch_id AS id
     FROM batches bat
     INNER JOIN inbound_requests ir ON ir.inbound_request_id = bat.inbound_request_id
     WHERE bat.batch_code = $1${whClause}
     LIMIT 2`,
    params
  );
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw new AppError('Ambiguous batch code', 409, 'AMBIGUOUS_SCAN');
  }
  return rows[0].id;
}

async function findBinByCode(code, warehouseId) {
  if (!warehouseId) {
    throw new AppError('warehouseId required to resolve BIN', 400, 'VALIDATION_ERROR');
  }
  const { rows } = await pool.query(
    `SELECT b.bin_id AS id
     FROM bins b
     INNER JOIN rack_levels rl ON rl.rack_level_id = b.rack_level_id
     INNER JOIN racks r ON r.rack_id = rl.rack_id
     INNER JOIN zones z ON z.zone_id = r.zone_id
     WHERE b.bin_code = $1 AND z.warehouse_id = $2
     LIMIT 2`,
    [code, warehouseId]
  );
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw new AppError('Ambiguous bin code in warehouse', 409, 'AMBIGUOUS_SCAN');
  }
  return rows[0].id;
}

async function findSkuByCodeInWarehouse(code, warehouseId) {
  if (!warehouseId) {
    throw new AppError('warehouseId required to resolve SKU', 400, 'VALIDATION_ERROR');
  }
  const { rows } = await pool.query(
    `SELECT DISTINCT s.sku_id AS id
     FROM skus s
     INNER JOIN inventories i ON i.sku_id = s.sku_id
     INNER JOIN bins b ON b.bin_id = i.bin_id
     INNER JOIN rack_levels rl ON rl.rack_level_id = b.rack_level_id
     INNER JOIN racks r ON r.rack_id = rl.rack_id
     INNER JOIN zones z ON z.zone_id = r.zone_id
     WHERE UPPER(s.sku_code) = UPPER($1) AND z.warehouse_id = $2
     LIMIT 2`,
    [code, warehouseId]
  );
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw new AppError('Ambiguous SKU code in warehouse', 409, 'AMBIGUOUS_SCAN');
  }
  return rows[0].id;
}

async function listLpnsForBatchScan(batchId) {
  const { rows } = await pool.query(
    `SELECT lpn_id, lpn_code, status, box_type, volume_units,
            actual_quantity, max_capacity, fill_percentage
     FROM lpns
     WHERE batch_id = $1
     ORDER BY lpn_code ASC`,
    [batchId]
  );
  return rows.map((row) => ({
    lpnId: row.lpn_id,
    lpnCode: row.lpn_code,
    status: row.status,
    boxType: row.box_type,
    volumeUnits: row.volume_units,
    actualQuantity: row.actual_quantity,
    maxCapacity: row.max_capacity,
    fillPercentage: row.fill_percentage,
  }));
}

/** Batch không có status — mobile nhận lô + danh sách LPN (status trên từng thùng). */
async function loadBatchScanEntity(batchId, actor) {
  const batch = await getBatch(batchId);
  const inbound = await assertInboundReadable(batch.inboundRequestId, actor);
  const lpns = await listLpnsForBatchScan(batchId);

  return {
    entity: {
      ...batch,
      inbound: {
        inboundRequestId: inbound.inboundRequestId,
        inboundCode: inbound.inboundCode,
        status: inbound.status,
        warehouseId: inbound.warehouseId,
        tenantId: inbound.tenantId,
      },
      lpns,
      lpnCount: lpns.length,
    },
    label: barcodeLabelResponse(BARCODE_ENTITY.BATCH, batch.batchCode, batch.batchId),
  };
}

async function loadEntitySummary(entityType, entityId, actor) {
  switch (entityType) {
    case BARCODE_ENTITY.INBOUND_REQUEST: {
      const inbound = await assertInboundReadable(entityId, actor);
      return {
        entity: inbound,
        label: barcodeLabelResponse(
          BARCODE_ENTITY.INBOUND_REQUEST,
          inbound.inboundCode,
          inbound.inboundRequestId
        ),
      };
    }
    case BARCODE_ENTITY.OUTBOUND_REQUEST: {
      const outbound = await getOutboundRequest(entityId);
      if (actor?.role !== 'SYSTEM_ADMIN') {
        assertWarehouseAccess(actor, outbound.warehouseId);
      }
      return {
        entity: outbound,
        label: barcodeLabelResponse(
          BARCODE_ENTITY.OUTBOUND_REQUEST,
          outbound.outboundCode,
          outbound.outboundRequestId
        ),
      };
    }
    case BARCODE_ENTITY.LPN: {
      const lpn = await getLpn(entityId);
      return {
        entity: lpn,
        label: barcodeLabelResponse(BARCODE_ENTITY.LPN, lpn.lpnCode, lpn.lpnId),
      };
    }
    case BARCODE_ENTITY.BATCH:
      return loadBatchScanEntity(entityId, actor);
    case BARCODE_ENTITY.BIN: {
      const { rows } = await pool.query(`SELECT * FROM bins WHERE bin_id = $1`, [entityId]);
      if (!rows[0]) throw new AppError('Bin not found', 404, 'NOT_FOUND');
      const bin = { binId: rows[0].bin_id, binCode: rows[0].bin_code, status: rows[0].status };
      return {
        entity: bin,
        label: barcodeLabelResponse(BARCODE_ENTITY.BIN, bin.binCode, bin.binId),
      };
    }
    case BARCODE_ENTITY.SKU: {
      const sku = await getSku(entityId);
      return {
        entity: sku,
        label: barcodeLabelResponse(BARCODE_ENTITY.SKU, sku.skuCode, sku.skuId),
      };
    }
    default:
      throw new AppError('Unsupported entity type', 400, 'VALIDATION_ERROR');
  }
}

const RESOLVERS = [
  {
    type: BARCODE_ENTITY.INBOUND_REQUEST,
    resolve: (key, whId) => findInboundByCode(key, whId),
  },
  {
    type: BARCODE_ENTITY.OUTBOUND_REQUEST,
    resolve: (key, whId) => findOutboundByCode(key, whId),
  },
  {
    type: BARCODE_ENTITY.BATCH,
    resolve: (key, whId) => findBatchByCode(key, whId),
  },
  {
    type: BARCODE_ENTITY.LPN,
    resolve: (key, whId) => findLpnByCode(key, whId),
  },
  {
    type: BARCODE_ENTITY.BIN,
    resolve: (key, whId) => findBinByCode(key, whId),
  },
  {
    type: BARCODE_ENTITY.SKU,
    resolve: (key, whId) => findSkuByCodeInWarehouse(key, whId),
  },
];

export async function resolveBarcodeScan(rawValue, actor, { warehouseId: queryWarehouseId } = {}) {
  assertScanRole(actor);
  const warehouseId = resolveWarehouseId(actor, queryWarehouseId);

  const parsed = parseScanValue(rawValue);
  if (!parsed.lookupKey) {
    throw new AppError('Scan value is required', 400, 'VALIDATION_ERROR');
  }

  const tryOrder = parsed.entityType
    ? RESOLVERS.filter((r) => r.type === parsed.entityType)
    : RESOLVERS;

  if (parsed.entityType && tryOrder.length === 0) {
    throw new AppError(`Unknown barcode entity alias`, 400, 'VALIDATION_ERROR');
  }

  for (const { type, resolve } of tryOrder) {
    const entityId = await resolve(parsed.lookupKey, warehouseId);
    if (!entityId) continue;

    const { entity, label } = await loadEntitySummary(type, entityId, actor);
    return {
      ...label,
      scanFormat: parsed.format,
      scannedRaw: normalizeScanValue(rawValue),
      entity,
    };
  }

  throw new AppError('No matching warehouse entity for scan value', 404, 'NOT_FOUND');
}
