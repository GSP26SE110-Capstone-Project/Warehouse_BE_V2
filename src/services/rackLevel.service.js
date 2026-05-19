import RackLevel from '../models/RackLevel.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { getRackById } from './rack.service.js';

const CREATE_FIELDS = [
  'levelCode',
  'levelNumber',
  'maxBins',
  'maxWeightKg',
  'heightCm',
  'levelPriority',
];

const UPDATE_FIELDS = ['levelCode', 'maxBins', 'maxWeightKg', 'heightCm', 'levelPriority'];

function pickFields(source, fields) {
  const result = {};
  for (const field of fields) {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
  }
  return result;
}

function parsePositiveInt(value, fieldName, { min = 1 } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) {
    throw new AppError(`${fieldName} must be an integer >= ${min}`, 400, 'VALIDATION_ERROR');
  }
  return n;
}

function parseOptionalNonNegativeInt(value, fieldName) {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new AppError(`${fieldName} must be a non-negative integer`, 400, 'VALIDATION_ERROR');
  }
  return n;
}

function parseOptionalDecimal(value, fieldName) {
  if (value == null) return undefined;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) {
    throw new AppError(`${fieldName} must be a non-negative number`, 400, 'VALIDATION_ERROR');
  }
  return n;
}

function normalizeCreatePayload(body, rackId) {
  const data = pickFields(body, CREATE_FIELDS);

  if (data.levelNumber == null) {
    throw new AppError('levelNumber is required', 400, 'VALIDATION_ERROR');
  }
  data.levelNumber = parsePositiveInt(data.levelNumber, 'levelNumber');

  if (data.levelCode != null) {
    data.levelCode = String(data.levelCode).trim() || undefined;
  }

  data.maxBins = parseOptionalNonNegativeInt(data.maxBins, 'maxBins');
  data.levelPriority = parseOptionalNonNegativeInt(data.levelPriority, 'levelPriority');
  data.maxWeightKg = parseOptionalDecimal(data.maxWeightKg, 'maxWeightKg');
  data.heightCm = parseOptionalDecimal(data.heightCm, 'heightCm');

  data.rackId = rackId;
  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.levelCode != null) {
    data.levelCode = String(data.levelCode).trim() || undefined;
  }

  data.maxBins = parseOptionalNonNegativeInt(data.maxBins, 'maxBins');
  data.levelPriority = parseOptionalNonNegativeInt(data.levelPriority, 'levelPriority');
  data.maxWeightKg = parseOptionalDecimal(data.maxWeightKg, 'maxWeightKg');
  data.heightCm = parseOptionalDecimal(data.heightCm, 'heightCm');

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

async function getRackLevelInRack(warehouseId, zoneId, rackId, rackLevelId) {
  const rId = parseUuid(rackId, 'rackId');
  const levelId = parseUuid(rackLevelId, 'rackLevelId');

  await getRackById(warehouseId, zoneId, rId);

  const level = await RackLevel.findOne({ rackLevelId: levelId, rackId: rId });
  if (!level) {
    throw new AppError('Rack level not found in this rack', 404, 'NOT_FOUND');
  }
  return level;
}

export async function listRackLevels(warehouseId, zoneId, rackId, { page, limit, offset }) {
  const rId = parseUuid(rackId, 'rackId');
  await getRackById(warehouseId, zoneId, rId);

  const filters = { rackId: rId };

  const [items, total] = await Promise.all([
    RackLevel.findAll(filters, {
      orderBy: 'level_number ASC',
      limit,
      offset,
    }),
    RackLevel.count(filters),
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

export async function getRackLevelById(warehouseId, zoneId, rackId, rackLevelId) {
  return getRackLevelInRack(warehouseId, zoneId, rackId, rackLevelId);
}

export async function createRackLevel(warehouseId, zoneId, rackId, body) {
  const rId = parseUuid(rackId, 'rackId');
  await getRackById(warehouseId, zoneId, rId);

  const data = normalizeCreatePayload(body, rId);
  return RackLevel.create(data);
}

export async function updateRackLevel(warehouseId, zoneId, rackId, rackLevelId, body) {
  const rId = parseUuid(rackId, 'rackId');
  const levelId = parseUuid(rackLevelId, 'rackLevelId');
  await getRackLevelInRack(warehouseId, zoneId, rId, levelId);

  const data = normalizeUpdatePayload(body);
  return RackLevel.updateById(levelId, data);
}

export async function deleteRackLevel(warehouseId, zoneId, rackId, rackLevelId) {
  const rId = parseUuid(rackId, 'rackId');
  const levelId = parseUuid(rackLevelId, 'rackLevelId');
  await getRackLevelInRack(warehouseId, zoneId, rId, levelId);

  const deleted = await RackLevel.deleteById(levelId);
  if (!deleted) {
    throw new AppError('Rack level not found in this rack', 404, 'NOT_FOUND');
  }
  return deleted;
}
