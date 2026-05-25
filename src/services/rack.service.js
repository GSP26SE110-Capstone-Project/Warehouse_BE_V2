import Rack from '../models/Rack.js';
import WarehouseZone from '../models/WarehouseZone.js';
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

export async function listRacks(zoneId, { status, rackType, page, limit, offset }) {
  const zId = parseUuid(zoneId, 'zoneId');
  await assertZoneExists(zId);

  assertEnum(status, RACK_STATUS, 'status');
  assertEnum(rackType, RACK_TYPE, 'rackType');

  const filters = { zoneId: zId };
  if (status) filters.status = status;
  if (rackType) filters.rackType = rackType;

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

export async function updateRack(rackId, body) {
  const id = parseUuid(rackId, 'rackId');
  await getRack(id);

  const data = normalizeUpdatePayload(body);
  return Rack.updateById(id, data);
}

export async function deleteRack(rackId) {
  const id = parseUuid(rackId, 'rackId');
  await getRack(id);

  const deleted = await Rack.deleteById(id);
  if (!deleted) {
    throw new AppError('Rack not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
