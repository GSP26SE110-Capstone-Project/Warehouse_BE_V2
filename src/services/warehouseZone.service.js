import WarehouseZone from '../models/WarehouseZone.js';
import AppError from '../utils/AppError.js';
import { ZONE_STATUS, ZONE_TYPE } from '../constants/warehouseStructure.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { getWarehouseById } from './warehouse.service.js';

const CREATE_FIELDS = [
  'zoneCode',
  'zoneName',
  'zoneType',
  'areaM2',
  'isDedicated',
  'status',
];

const UPDATE_FIELDS = [
  'zoneName',
  'zoneType',
  'areaM2',
  'isDedicated',
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

function normalizeCreatePayload(body, warehouseId) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.zoneCode?.trim()) {
    throw new AppError('zoneCode is required', 400, 'VALIDATION_ERROR');
  }

  data.zoneCode = data.zoneCode.trim();
  if (data.zoneName != null) data.zoneName = String(data.zoneName).trim();
  if (data.zoneType == null) data.zoneType = 'SHARED';
  if (data.status == null) data.status = 'ACTIVE';
  if (data.isDedicated == null) data.isDedicated = false;

  assertEnum(data.zoneType, ZONE_TYPE, 'zoneType');
  assertEnum(data.status, ZONE_STATUS, 'status');

  data.warehouseId = warehouseId;
  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.zoneName != null) data.zoneName = String(data.zoneName).trim();
  assertEnum(data.zoneType, ZONE_TYPE, 'zoneType');
  assertEnum(data.status, ZONE_STATUS, 'status');

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

async function getZoneInWarehouse(warehouseId, zoneId) {
  const whId = parseUuid(warehouseId, 'warehouseId');
  const zId = parseUuid(zoneId, 'zoneId');

  await getWarehouseById(whId);

  const zone = await WarehouseZone.findOne({ zoneId: zId, warehouseId: whId });
  if (!zone) {
    throw new AppError('Zone not found in this warehouse', 404, 'NOT_FOUND');
  }
  return zone;
}

export async function listZones(warehouseId, { status, zoneType, page, limit, offset }) {
  const whId = parseUuid(warehouseId, 'warehouseId');
  await getWarehouseById(whId);

  assertEnum(status, ZONE_STATUS, 'status');
  assertEnum(zoneType, ZONE_TYPE, 'zoneType');

  const filters = { warehouseId: whId };
  if (status) filters.status = status;
  if (zoneType) filters.zoneType = zoneType;

  const [items, total] = await Promise.all([
    WarehouseZone.findAll(filters, {
      orderBy: 'created_at DESC',
      limit,
      offset,
    }),
    WarehouseZone.count(filters),
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

export async function getZoneById(warehouseId, zoneId) {
  return getZoneInWarehouse(warehouseId, zoneId);
}

export async function createZone(warehouseId, body) {
  const whId = parseUuid(warehouseId, 'warehouseId');
  await getWarehouseById(whId);

  const data = normalizeCreatePayload(body, whId);
  return WarehouseZone.create(data);
}

export async function updateZone(warehouseId, zoneId, body) {
  const whId = parseUuid(warehouseId, 'warehouseId');
  const zId = parseUuid(zoneId, 'zoneId');
  await getZoneInWarehouse(whId, zId);

  const data = normalizeUpdatePayload(body);
  return WarehouseZone.updateById(zId, data);
}

export async function deleteZone(warehouseId, zoneId) {
  const whId = parseUuid(warehouseId, 'warehouseId');
  const zId = parseUuid(zoneId, 'zoneId');
  await getZoneInWarehouse(whId, zId);

  const deleted = await WarehouseZone.deleteById(zId);
  if (!deleted) {
    throw new AppError('Zone not found in this warehouse', 404, 'NOT_FOUND');
  }
  return deleted;
}
