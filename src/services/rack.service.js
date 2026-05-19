import Rack from '../models/Rack.js';
import AppError from '../utils/AppError.js';
import { RACK_STATUS, RACK_TYPE } from '../constants/warehouseStructure.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { getZoneById } from './warehouseZone.service.js';

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

async function getRackInZone(warehouseId, zoneId, rackId) {
  const zId = parseUuid(zoneId, 'zoneId');
  const rId = parseUuid(rackId, 'rackId');

  await getZoneById(warehouseId, zId);

  const rack = await Rack.findOne({ rackId: rId, zoneId: zId });
  if (!rack) {
    throw new AppError('Rack not found in this zone', 404, 'NOT_FOUND');
  }
  return rack;
}

export async function listRacks(warehouseId, zoneId, { status, rackType, page, limit, offset }) {
  const zId = parseUuid(zoneId, 'zoneId');
  await getZoneById(warehouseId, zId);

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

export async function getRackById(warehouseId, zoneId, rackId) {
  return getRackInZone(warehouseId, zoneId, rackId);
}

export async function createRack(warehouseId, zoneId, body) {
  const zId = parseUuid(zoneId, 'zoneId');
  await getZoneById(warehouseId, zId);

  const data = normalizeCreatePayload(body, zId);
  return Rack.create(data);
}

export async function updateRack(warehouseId, zoneId, rackId, body) {
  const zId = parseUuid(zoneId, 'zoneId');
  const rId = parseUuid(rackId, 'rackId');
  await getRackInZone(warehouseId, zId, rId);

  const data = normalizeUpdatePayload(body);
  return Rack.updateById(rId, data);
}

export async function deleteRack(warehouseId, zoneId, rackId) {
  const zId = parseUuid(zoneId, 'zoneId');
  const rId = parseUuid(rackId, 'rackId');
  await getRackInZone(warehouseId, zId, rId);

  const deleted = await Rack.deleteById(rId);
  if (!deleted) {
    throw new AppError('Rack not found in this zone', 404, 'NOT_FOUND');
  }
  return deleted;
}
