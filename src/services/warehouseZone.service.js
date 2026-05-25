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

async function assertZoneAreaWithinWarehouse(warehouseId, areaM2, excludeZoneId = null) {
  const warehouse = await getWarehouseById(warehouseId);
  const usable = warehouse.usableAreaM2 != null ? Number(warehouse.usableAreaM2) : null;
  if (usable == null || usable <= 0) return;

  const zones = await WarehouseZone.findAll({ warehouseId });
  let sum = 0;
  for (const z of zones) {
    if (excludeZoneId && z.zoneId === excludeZoneId) continue;
    sum += Number(z.areaM2) || 0;
  }
  sum += Number(areaM2) || 0;

  if (sum > usable) {
    throw new AppError(
      `Total zone area (${sum} m²) exceeds warehouse usable area (${usable} m²)`,
      400,
      'CAPACITY_EXCEEDED'
    );
  }
}

export async function getZone(zoneId) {
  const id = parseUuid(zoneId, 'zoneId');
  const zone = await WarehouseZone.findById(id);
  if (!zone) {
    throw new AppError('Zone not found', 404, 'NOT_FOUND');
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

export async function createZone(warehouseId, body) {
  const whId = parseUuid(warehouseId, 'warehouseId');
  await getWarehouseById(whId);

  const data = normalizeCreatePayload(body, whId);
  if (data.areaM2 != null) {
    await assertZoneAreaWithinWarehouse(whId, data.areaM2);
  }
  return WarehouseZone.create(data);
}

export async function updateZone(zoneId, body) {
  const id = parseUuid(zoneId, 'zoneId');
  const zone = await getZone(id);

  const data = normalizeUpdatePayload(body);
  const nextArea = data.areaM2 !== undefined ? data.areaM2 : zone.areaM2;
  if (nextArea != null) {
    await assertZoneAreaWithinWarehouse(zone.warehouseId, nextArea, id);
  }
  return WarehouseZone.updateById(id, data);
}

export async function deleteZone(zoneId) {
  const id = parseUuid(zoneId, 'zoneId');
  await getZone(id);

  const deleted = await WarehouseZone.deleteById(id);
  if (!deleted) {
    throw new AppError('Zone not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
