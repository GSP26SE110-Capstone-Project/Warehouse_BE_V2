import Bin from '../models/Bin.js';
import pool from '../config/db.js';
import WarehouseZone from '../models/WarehouseZone.js';
import AppError from '../utils/AppError.js';
import {
  BIN_STATUS,
  BOX_TYPE,
  RESERVATION_TYPE,
} from '../constants/warehouseStructure.js';
import { computeZoneStorageCapacity } from '../constants/warehouseCapacity.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { getRack } from './rack.service.js';
import { getRackLevel } from './rackLevel.service.js';

const CREATE_FIELDS = [
  'binCode',
  'supportedBoxType',
  'maxLpnCount',
  'maxVolumeUnits',
  'maxOwnerCount',
  'reservationType',
  'status',
];

const UPDATE_FIELDS = [
  'supportedBoxType',
  'maxLpnCount',
  'maxVolumeUnits',
  'maxOwnerCount',
  'reservationType',
  'status',
];

function pickFields(source, fields) {
  const result = {};
  for (const field of fields) {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
  }
  return result;
}

function parsePositiveInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new AppError(`${fieldName} must be a positive integer`, 400, 'VALIDATION_ERROR');
  }
  return n;
}

function normalizeCreatePayload(body, rackLevelId) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.binCode?.trim()) {
    throw new AppError('binCode is required', 400, 'VALIDATION_ERROR');
  }

  data.binCode = data.binCode.trim();

  if (data.maxLpnCount == null) {
    throw new AppError('maxLpnCount is required', 400, 'VALIDATION_ERROR');
  }
  if (data.maxVolumeUnits == null) {
    throw new AppError('maxVolumeUnits is required', 400, 'VALIDATION_ERROR');
  }

  data.maxLpnCount = parsePositiveInt(data.maxLpnCount, 'maxLpnCount');
  data.maxVolumeUnits = parsePositiveInt(data.maxVolumeUnits, 'maxVolumeUnits');

  if (data.maxOwnerCount == null) data.maxOwnerCount = 3;
  else data.maxOwnerCount = parsePositiveInt(data.maxOwnerCount, 'maxOwnerCount');

  if (data.reservationType == null) data.reservationType = 'SHARED';
  if (data.status == null) data.status = 'EMPTY';

  assertEnum(data.supportedBoxType, BOX_TYPE, 'supportedBoxType');
  assertEnum(data.reservationType, RESERVATION_TYPE, 'reservationType');
  assertEnum(data.status, BIN_STATUS, 'status');

  data.rackLevelId = rackLevelId;
  data.currentLpnCount = 0;
  data.usedVolumeUnits = 0;

  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  assertEnum(data.supportedBoxType, BOX_TYPE, 'supportedBoxType');
  assertEnum(data.reservationType, RESERVATION_TYPE, 'reservationType');
  assertEnum(data.status, BIN_STATUS, 'status');

  if (data.maxLpnCount != null) {
    data.maxLpnCount = parsePositiveInt(data.maxLpnCount, 'maxLpnCount');
  }
  if (data.maxVolumeUnits != null) {
    data.maxVolumeUnits = parsePositiveInt(data.maxVolumeUnits, 'maxVolumeUnits');
  }
  if (data.maxOwnerCount != null) {
    data.maxOwnerCount = parsePositiveInt(data.maxOwnerCount, 'maxOwnerCount');
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

export async function getBin(binId) {
  const id = parseUuid(binId, 'binId');
  const bin = await Bin.findById(id);
  if (!bin) {
    throw new AppError('Bin not found', 404, 'NOT_FOUND');
  }
  return bin;
}

export async function listBins(
  rackLevelId,
  { status, reservationType, supportedBoxType, page, limit, offset }
) {
  const levelId = parseUuid(rackLevelId, 'rackLevelId');
  await getRackLevel(levelId);

  assertEnum(status, BIN_STATUS, 'status');
  assertEnum(reservationType, RESERVATION_TYPE, 'reservationType');
  assertEnum(supportedBoxType, BOX_TYPE, 'supportedBoxType');

  const filters = { rackLevelId: levelId };
  if (status) filters.status = status;
  if (reservationType) filters.reservationType = reservationType;
  if (supportedBoxType) filters.supportedBoxType = supportedBoxType;

  const [items, total] = await Promise.all([
    Bin.findAll(filters, {
      orderBy: 'bin_code ASC',
      limit,
      offset,
    }),
    Bin.count(filters),
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

async function getBinsPerLevelForRackLevel(rackLevelId) {
  const level = await getRackLevel(rackLevelId);
  const rack = await getRack(level.rackId);
  const zone = await WarehouseZone.findById(rack.zoneId);
  if (!zone) {
    throw new AppError('Zone not found', 404, 'NOT_FOUND');
  }
  const capacity = computeZoneStorageCapacity(zone.areaM2);
  if (!capacity.hasArea || capacity.binsPerLevel < 1) {
    throw new AppError(
      'Zone must have areaM2 set before adding bins',
      400,
      'VALIDATION_ERROR'
    );
  }
  return { binsPerLevel: capacity.binsPerLevel, level, rack, zone };
}

async function assertLevelBinCapacity(rackLevelId, additionalCount) {
  const { binsPerLevel } = await getBinsPerLevelForRackLevel(rackLevelId);
  const levelId = parseUuid(rackLevelId, 'rackLevelId');
  const current = await Bin.count({ rackLevelId: levelId });
  if (current + additionalCount > binsPerLevel) {
    throw new AppError(
      `Rack level can have at most ${binsPerLevel} bins (${current} existing, +${additionalCount} requested)`,
      400,
      'CAPACITY_EXCEEDED'
    );
  }
  return binsPerLevel;
}

export async function createBin(rackLevelId, body) {
  const levelId = parseUuid(rackLevelId, 'rackLevelId');
  await assertLevelBinCapacity(levelId, 1);

  const data = normalizeCreatePayload(body, levelId);
  return Bin.create(data);
}

export async function createBinsBulk(body) {
  const rawBins = body.bins;
  if (!Array.isArray(rawBins) || rawBins.length === 0) {
    throw new AppError('bins must be a non-empty array', 400, 'VALIDATION_ERROR');
  }
  if (rawBins.length > 500) {
    throw new AppError('Maximum 500 bins per bulk request', 400, 'VALIDATION_ERROR');
  }

  const byLevel = new Map();
  const seenCodes = new Set();

  for (const entry of rawBins) {
    const levelId = parseUuid(entry.rackLevelId, 'rackLevelId');
    const codeKey = `${levelId}:${String(entry.binCode ?? '').trim().toUpperCase()}`;
    if (!entry.binCode?.trim()) {
      throw new AppError('Each bin requires binCode', 400, 'VALIDATION_ERROR');
    }
    if (seenCodes.has(codeKey)) {
      throw new AppError('Duplicate binCode in request for same level', 400, 'VALIDATION_ERROR');
    }
    seenCodes.add(codeKey);
    if (!byLevel.has(levelId)) byLevel.set(levelId, []);
    byLevel.get(levelId).push(entry);
  }

  for (const [levelId, entries] of byLevel.entries()) {
    await assertLevelBinCapacity(levelId, entries.length);

    const existing = await Bin.findAll({ rackLevelId: levelId }, { limit: 500, offset: 0 });
    const existingCodes = new Set(existing.map((b) => b.binCode?.toUpperCase()));
    const duplicate = entries.filter((e) =>
      existingCodes.has(String(e.binCode).trim().toUpperCase())
    );
    if (duplicate.length) {
      const sample = duplicate.slice(0, 3).map((d) => d.binCode).join(', ');
      throw new AppError(
        `Bin code already exists on level: ${sample}${duplicate.length > 3 ? '…' : ''}`,
        400,
        'VALIDATION_ERROR'
      );
    }
  }

  const sharedDefaults = {
    maxLpnCount: body.maxLpnCount,
    maxVolumeUnits: body.maxVolumeUnits,
    reservationType: body.reservationType,
    status: body.status,
    supportedBoxType: body.supportedBoxType,
    maxOwnerCount: body.maxOwnerCount,
  };

  const created = [];
  for (const entry of rawBins) {
    const levelId = parseUuid(entry.rackLevelId, 'rackLevelId');
    const payload = {
      binCode: entry.binCode,
      maxLpnCount: entry.maxLpnCount ?? sharedDefaults.maxLpnCount,
      maxVolumeUnits: entry.maxVolumeUnits ?? sharedDefaults.maxVolumeUnits,
      reservationType: entry.reservationType ?? sharedDefaults.reservationType,
      status: entry.status ?? sharedDefaults.status,
      supportedBoxType: entry.supportedBoxType ?? sharedDefaults.supportedBoxType,
      maxOwnerCount: entry.maxOwnerCount ?? sharedDefaults.maxOwnerCount,
    };
    const data = normalizeCreatePayload(payload, levelId);
    const bin = await Bin.create(data);
    created.push(bin);
  }

  return {
    items: created,
    meta: { created: created.length },
  };
}

export async function updateBin(binId, body) {
  const id = parseUuid(binId, 'binId');
  await getBin(id);

  const data = normalizeUpdatePayload(body);
  return Bin.updateById(id, data);
}

export async function deleteBin(binId) {
  const id = parseUuid(binId, 'binId');
  const bin = await getBin(id);

  const usedVol = Number(bin.usedVolumeUnits ?? 0);
  const lpnCount = Number(bin.currentLpnCount ?? 0);
  if (usedVol > 0 || lpnCount > 0) {
    throw new AppError(
      'Bin đang chứa LPN hoặc hàng — cần dời hết trước khi xóa',
      400,
      'BIN_NOT_EMPTY'
    );
  }

  const check = await pool.query(
    `SELECT
      (SELECT COUNT(*)::int FROM inventories WHERE bin_id = $1) AS inv_count,
      (SELECT COUNT(*)::int FROM lpns WHERE current_bin_id = $1) AS lpn_count`,
    [id]
  );
  const { inv_count: invCount, lpn_count: storedLpnCount } = check.rows[0] ?? {};
  if ((invCount ?? 0) > 0 || (storedLpnCount ?? 0) > 0) {
    throw new AppError(
      'Bin đang chứa LPN hoặc hàng — cần dời hết trước khi xóa',
      400,
      'BIN_NOT_EMPTY'
    );
  }

  const deleted = await Bin.deleteById(id);
  if (!deleted) {
    throw new AppError('Bin not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
