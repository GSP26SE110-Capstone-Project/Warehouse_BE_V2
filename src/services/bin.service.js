import Bin from '../models/Bin.js';
import AppError from '../utils/AppError.js';
import {
  BIN_STATUS,
  BOX_TYPE,
  RESERVATION_TYPE,
} from '../constants/warehouseStructure.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
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

export async function createBin(rackLevelId, body) {
  const levelId = parseUuid(rackLevelId, 'rackLevelId');
  await getRackLevel(levelId);

  const data = normalizeCreatePayload(body, levelId);
  return Bin.create(data);
}

export async function updateBin(binId, body) {
  const id = parseUuid(binId, 'binId');
  await getBin(id);

  const data = normalizeUpdatePayload(body);
  return Bin.updateById(id, data);
}

export async function deleteBin(binId) {
  const id = parseUuid(binId, 'binId');
  await getBin(id);

  const deleted = await Bin.deleteById(id);
  if (!deleted) {
    throw new AppError('Bin not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
