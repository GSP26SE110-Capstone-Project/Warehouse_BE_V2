import Rack, { rackSchema } from '../models/Rack.js';
import { fromDbRecord } from '../models/utils/fieldMapper.js';
import WarehouseZone from '../models/WarehouseZone.js';
import pool from '../config/db.js';
import AppError from '../utils/AppError.js';
import {
  RACK_FIXED_LEVEL_COUNT,
  RACK_STATUS,
  RACK_TYPE,
} from '../constants/warehouseStructure.js';
import {
  computeZoneStorageCapacity,
  RACK_FOOTPRINT_M2,
} from '../constants/warehouseCapacity.js';
import { assertEnum, parseUuid } from '../utils/validate.js';

const CREATE_FIELDS = ['rackCode', 'rackType', 'maxLevels', 'status'];

const UPDATE_FIELDS = ['rackType', 'maxLevels', 'status'];

function pickFields(source, fields) {
  const result = {};
  for (const field of fields) {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
  }
  return result;
}

function normalizeCreatePayload(body, zoneId) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.rackCode?.trim()) {
    throw new AppError('rackCode is required', 400, 'VALIDATION_ERROR');
  }

  data.rackCode = data.rackCode.trim();
  if (data.rackType == null) data.rackType = 'STANDARD';
  if (data.maxLevels == null) data.maxLevels = RACK_FIXED_LEVEL_COUNT;
  if (data.status == null) data.status = 'ACTIVE';

  assertEnum(data.rackType, RACK_TYPE, 'rackType');
  assertEnum(data.status, RACK_STATUS, 'status');

  if (data.maxLevels != null) {
    const maxLevels = Number(data.maxLevels);
    if (!Number.isInteger(maxLevels) || maxLevels < 1) {
      throw new AppError('maxLevels must be a positive integer', 400, 'VALIDATION_ERROR');
    }
    data.maxLevels = maxLevels;
  }

  data.zoneId = zoneId;
  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  assertEnum(data.rackType, RACK_TYPE, 'rackType');
  assertEnum(data.status, RACK_STATUS, 'status');

  if (data.maxLevels != null) {
    const maxLevels = Number(data.maxLevels);
    if (!Number.isInteger(maxLevels) || maxLevels < 1) {
      throw new AppError('maxLevels must be a positive integer', 400, 'VALIDATION_ERROR');
    }
    data.maxLevels = maxLevels;
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

async function assertZoneExists(zoneId) {
  const zId = parseUuid(zoneId, 'zoneId');
  const zone = await WarehouseZone.findById(zId);
  if (!zone) {
    throw new AppError('Zone not found', 404, 'NOT_FOUND');
  }
  return zone;
}

async function assertRackCapacity(zone) {
  const capacity = computeZoneStorageCapacity(zone.areaM2);
  if (!capacity.hasArea) {
    throw new AppError(
      'Zone must have areaM2 set before adding racks',
      400,
      'VALIDATION_ERROR'
    );
  }
  const current = await Rack.count({ zoneId: zone.zoneId });
  if (current >= capacity.maxRacks) {
    throw new AppError(
      `Zone capacity reached: max ${capacity.maxRacks} racks (${RACK_FOOTPRINT_M2} m²/rack on ${capacity.storageAreaM2.toFixed(1)} m² storage after ${Math.round(capacity.aisleRatio * 100)}% aisles)`,
      400,
      'CAPACITY_EXCEEDED'
    );
  }
  return capacity;
}

export async function getRack(rackId) {
  const id = parseUuid(rackId, 'rackId');
  const rack = await Rack.findById(id);
  if (!rack) {
    throw new AppError('Rack not found', 404, 'NOT_FOUND');
  }
  return rack;
}

function mapRackBinStatsRow(row) {
  const base = fromDbRecord(rackSchema, row) ?? {};
  const binCount = Number(row.bin_count) || 0;
  const usedBinCount = Number(row.used_bin_count) || 0;
  const maxLpnTotal = Number(row.max_lpn_total) || 0;
  const usedLpnTotal = Number(row.used_lpn_total) || 0;

  let usagePercent = 0;
  if (maxLpnTotal > 0) {
    usagePercent = Math.min(100, Math.round((usedLpnTotal / maxLpnTotal) * 100));
  } else if (binCount > 0) {
    usagePercent = Math.min(100, Math.round((usedBinCount / binCount) * 100));
  }

  return {
    ...base,
    binCount,
    usedBinCount,
    maxLpnTotal,
    usedLpnTotal,
    usagePercent,
    hasBins: binCount > 0,
  };
}

export async function listRacks(
  zoneId,
  { status, rackType, page, limit, offset, includeBinStats }
) {
  const zId = parseUuid(zoneId, 'zoneId');
  await assertZoneExists(zId);

  assertEnum(status, RACK_STATUS, 'status');
  assertEnum(rackType, RACK_TYPE, 'rackType');

  const filters = { zoneId: zId };
  if (status) filters.status = status;
  if (rackType) filters.rackType = rackType;

  if (includeBinStats) {
    const clauses = ['r.zone_id = $1'];
    const values = [zId];
    let n = 2;
    if (status) {
      clauses.push(`r.status = $${n++}::rack_status_enum`);
      values.push(status);
    }
    if (rackType) {
      clauses.push(`r.rack_type = $${n++}::rack_type_enum`);
      values.push(rackType);
    }
    const whereSql = clauses.join(' AND ');
    const limitVal = limit ?? 100;
    const offsetVal = offset ?? 0;
    const paginationValues = [...values, limitVal, offsetVal];

    const rows = await Rack.query(
      `SELECT r.*,
              COALESCE(bs.bin_count, 0)::int AS bin_count,
              COALESCE(bs.used_bin_count, 0)::int AS used_bin_count,
              COALESCE(bs.max_lpn_total, 0)::int AS max_lpn_total,
              COALESCE(bs.used_lpn_total, 0)::int AS used_lpn_total
       FROM racks r
       LEFT JOIN LATERAL (
         SELECT COUNT(b.bin_id)::int AS bin_count,
                COUNT(b.bin_id) FILTER (
                  WHERE b.status IN ('PARTIAL', 'FULL', 'RESERVED')
                )::int AS used_bin_count,
                COALESCE(SUM(b.max_lpn_count), 0)::int AS max_lpn_total,
                COALESCE(SUM(b.current_lpn_count), 0)::int AS used_lpn_total
         FROM rack_levels rl
         LEFT JOIN bins b ON b.rack_level_id = rl.rack_level_id
         WHERE rl.rack_id = r.rack_id
       ) bs ON TRUE
       WHERE ${whereSql}
       ORDER BY r.created_at DESC
       LIMIT $${paginationValues.length - 1}
       OFFSET $${paginationValues.length}`,
      paginationValues
    );

    const countRow = await Rack.queryOne(
      `SELECT COUNT(*)::int AS count FROM racks r WHERE ${whereSql}`,
      values
    );
    const total = countRow?.count ?? 0;
    const items = rows.map(mapRackBinStatsRow);

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

  const [items, total] = await Promise.all([
    Rack.findAll(filters, {
      orderBy: 'created_at DESC',
      limit,
      offset,
    }),
    Rack.count(filters),
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

export async function createRack(zoneId, body) {
  const zId = parseUuid(zoneId, 'zoneId');
  const zone = await assertZoneExists(zId);
  await assertRackCapacity(zone);

  const data = normalizeCreatePayload(body, zId);
  return Rack.create(data);
}

export async function createRacksBulk(zoneId, body) {
  const zId = parseUuid(zoneId, 'zoneId');
  const zone = await assertZoneExists(zId);
  const capacity = computeZoneStorageCapacity(zone.areaM2);
  if (!capacity.hasArea) {
    throw new AppError(
      'Zone must have areaM2 set before adding racks',
      400,
      'VALIDATION_ERROR'
    );
  }

  const rawCodes = body.rackCodes;
  if (!Array.isArray(rawCodes) || rawCodes.length === 0) {
    throw new AppError('rackCodes must be a non-empty array', 400, 'VALIDATION_ERROR');
  }

  const rackCodes = [...new Set(rawCodes.map((c) => String(c).trim()).filter(Boolean))];
  if (rackCodes.length !== rawCodes.length) {
    throw new AppError('rackCodes must be unique', 400, 'VALIDATION_ERROR');
  }
  if (rackCodes.length > 100) {
    throw new AppError('Maximum 100 racks per bulk request', 400, 'VALIDATION_ERROR');
  }

  const current = await Rack.count({ zoneId: zId });
  const remaining = capacity.maxRacks - current;
  if (remaining <= 0) {
    throw new AppError(
      `Zone capacity reached: max ${capacity.maxRacks} racks`,
      400,
      'CAPACITY_EXCEEDED'
    );
  }
  if (rackCodes.length > remaining) {
    throw new AppError(
      `Cannot create ${rackCodes.length} racks: only ${remaining} slot(s) left (max ${capacity.maxRacks})`,
      400,
      'CAPACITY_EXCEEDED'
    );
  }

  const existingInZone = await Rack.findAll({ zoneId: zId }, { limit: 500, offset: 0 });
  const existingCodes = new Set(existingInZone.map((r) => r.rackCode?.toUpperCase()));
  const duplicate = rackCodes.filter((c) => existingCodes.has(c.toUpperCase()));
  if (duplicate.length) {
    throw new AppError(
      `Rack code already exists in zone: ${duplicate.slice(0, 5).join(', ')}${duplicate.length > 5 ? '…' : ''}`,
      400,
      'VALIDATION_ERROR'
    );
  }

  const sharedStatus = body.status ?? 'ACTIVE';
  const created = [];

  for (const rackCode of rackCodes) {
    const data = normalizeCreatePayload(
      { rackCode, status: sharedStatus, rackType: body.rackType, maxLevels: body.maxLevels },
      zId
    );
    const rack = await Rack.create(data);
    created.push(rack);
  }

  return {
    items: created,
    meta: {
      created: created.length,
      zoneId: zId,
      remainingSlots: remaining - created.length,
    },
  };
}

export async function updateRack(rackId, body) {
  const id = parseUuid(rackId, 'rackId');
  await getRack(id);

  const data = normalizeUpdatePayload(body);
  return Rack.updateById(id, data);
}

async function assertRackDeletable(rackId) {
  const { rows } = await pool.query(
    `SELECT b.bin_id, b.bin_code, b.used_volume_units, b.current_lpn_count,
            COALESCE(inv.cnt, 0)::int AS inv_count,
            COALESCE(lpn.cnt, 0)::int AS lpn_count
     FROM bins b
     INNER JOIN rack_levels rl ON rl.rack_level_id = b.rack_level_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS cnt
       FROM inventories i
       WHERE i.bin_id = b.bin_id AND i.quantity > 0
     ) inv ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS cnt
       FROM lpns l
       WHERE l.current_bin_id = b.bin_id
     ) lpn ON true
     WHERE rl.rack_id = $1`,
    [rackId]
  );

  const blocked = rows.filter((row) => {
    const usedVol = Number(row.used_volume_units ?? 0);
    const lpnCount = Number(row.current_lpn_count ?? 0);
    return usedVol > 0 || lpnCount > 0 || row.inv_count > 0 || row.lpn_count > 0;
  });

  if (blocked.length === 0) return;

  const samples = blocked
    .slice(0, 5)
    .map((r) => r.bin_code)
    .join(', ');
  const more = blocked.length > 5 ? ` (+${blocked.length - 5} bin khác)` : '';

  throw new AppError(
    `Không thể xóa rack — còn ${blocked.length} bin đang chứa LPN hoặc hàng (putaway): ${samples}${more}. Dời hết hàng/LPN ra khỏi bin trước khi xóa rack.`,
    400,
    'RACK_NOT_EMPTY'
  );
}

export async function deleteRack(rackId) {
  const id = parseUuid(rackId, 'rackId');
  await getRack(id);
  await assertRackDeletable(id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM bins
       WHERE rack_level_id IN (
         SELECT rack_level_id FROM rack_levels WHERE rack_id = $1
       )`,
      [id]
    );
    await client.query(`DELETE FROM rack_levels WHERE rack_id = $1`, [id]);
    const deleted = await Rack.deleteById(id, client);
    if (!deleted) {
      throw new AppError('Rack not found', 404, 'NOT_FOUND');
    }
    await client.query('COMMIT');
    return deleted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
