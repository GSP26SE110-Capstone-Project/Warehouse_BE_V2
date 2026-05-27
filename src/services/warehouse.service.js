import Warehouse from '../models/Warehouse.js';
import WarehouseZone from '../models/WarehouseZone.js';
import AppError from '../utils/AppError.js';
import { REFERENCE_ZONE_AREA_M2 } from '../constants/warehouseCapacity.js';
import { WAREHOUSE_STATUS } from '../constants/warehouseStructure.js';
import { getScopedWarehouseId } from '../utils/warehouseAccess.js';
import { assertEnum, parseUuid } from '../utils/validate.js';

const CREATE_FIELDS = [
  'warehouseCode',
  'warehouseName',
  'address',
  'city',
  'district',
  'totalAreaM2',
  'usableAreaM2',
  'status',
];

const UPDATE_FIELDS = [
  'warehouseName',
  'address',
  'city',
  'district',
  'totalAreaM2',
  'usableAreaM2',
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

function normalizeCreatePayload(body) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.warehouseCode?.trim()) {
    throw new AppError('warehouseCode is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.warehouseName?.trim()) {
    throw new AppError('warehouseName is required', 400, 'VALIDATION_ERROR');
  }

  data.warehouseCode = data.warehouseCode.trim();
  data.warehouseName = data.warehouseName.trim();
  if (data.address != null) data.address = String(data.address).trim();
  if (data.city != null) data.city = String(data.city).trim();
  if (data.district != null) data.district = String(data.district).trim();
  if (data.status == null) data.status = 'ACTIVE';

  assertEnum(data.status, WAREHOUSE_STATUS, 'status');
  assertWarehouseAreas(data);
  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.warehouseName != null) {
    data.warehouseName = String(data.warehouseName).trim();
    if (!data.warehouseName) {
      throw new AppError('warehouseName cannot be empty', 400, 'VALIDATION_ERROR');
    }
  }
  if (data.address != null) data.address = String(data.address).trim();
  if (data.city != null) data.city = String(data.city).trim();
  if (data.district != null) data.district = String(data.district).trim();
  assertEnum(data.status, WAREHOUSE_STATUS, 'status');

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

function parseArea(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function assertWarehouseAreas(data, existing = null) {
  const total = parseArea(
    data.totalAreaM2 !== undefined ? data.totalAreaM2 : existing?.totalAreaM2
  );
  const usable = parseArea(
    data.usableAreaM2 !== undefined ? data.usableAreaM2 : existing?.usableAreaM2
  );

  if (total != null && usable != null && usable > total) {
    throw new AppError(
      `Diện tích sử dụng (${usable} m²) không được lớn hơn tổng diện tích (${total} m²)`,
      400,
      'AREA_EXCEEDS_TOTAL'
    );
  }
}

export async function sumZoneAreaM2(warehouseId) {
  const zones = await WarehouseZone.findAll({ warehouseId });
  return zones.reduce((sum, z) => sum + (Number(z.areaM2) || 0), 0);
}

export async function getWarehouseZonePlanning(warehouseId) {
  const warehouse = await getWarehouseById(warehouseId);
  const usedZoneAreaM2 = await sumZoneAreaM2(warehouseId);
  const totalAreaM2 = parseArea(warehouse.totalAreaM2);
  const usableAreaM2 = parseArea(warehouse.usableAreaM2);
  const remainingZoneAreaM2 =
    usableAreaM2 != null ? Math.max(0, usableAreaM2 - usedZoneAreaM2) : null;

  const suggestedReferenceZoneAreaM2 = REFERENCE_ZONE_AREA_M2;
  const suggestedMinZoneCount =
    usableAreaM2 != null && usableAreaM2 > 0
      ? Math.max(1, Math.ceil(usableAreaM2 / REFERENCE_ZONE_AREA_M2))
      : null;

  const zones = await WarehouseZone.findAll({ warehouseId });
  const zoneCount = zones.length;
  const missingZoneCount =
    suggestedMinZoneCount != null ? Math.max(0, suggestedMinZoneCount - zoneCount) : null;

  const suggestedAreaPerZoneForEvenSplit =
    missingZoneCount != null && missingZoneCount > 0 && remainingZoneAreaM2 != null
      ? Math.round((remainingZoneAreaM2 / missingZoneCount) * 100) / 100
      : suggestedReferenceZoneAreaM2;

  return {
    warehouseId,
    totalAreaM2,
    usableAreaM2,
    usedZoneAreaM2,
    remainingZoneAreaM2,
    zoneCount,
    suggestedReferenceZoneAreaM2,
    suggestedMinZoneCount,
    missingZoneCount,
    suggestedAreaPerZoneForEvenSplit,
    areaValid:
      totalAreaM2 == null ||
      usableAreaM2 == null ||
      (usableAreaM2 <= totalAreaM2 &&
        (usableAreaM2 == null || usedZoneAreaM2 <= usableAreaM2)),
  };
}

export async function listWarehouses({ status, page, limit, offset, scopedWarehouseId }) {
  assertEnum(status, WAREHOUSE_STATUS, 'status');

  const filters = {};
  if (status) filters.status = status;
  if (scopedWarehouseId) filters.warehouseId = scopedWarehouseId;

  const [items, total] = await Promise.all([
    Warehouse.findAll(filters, {
      orderBy: 'created_at DESC',
      limit,
      offset,
    }),
    Warehouse.count(filters),
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

export async function getWarehouseById(warehouseId) {
  const id = parseUuid(warehouseId, 'warehouseId');
  const warehouse = await Warehouse.findById(id);
  if (!warehouse) {
    throw new AppError('Warehouse not found', 404, 'NOT_FOUND');
  }
  return warehouse;
}

export async function createWarehouse(body, user) {
  if (user?.role !== 'SYSTEM_ADMIN') {
    throw new AppError('SYSTEM_ADMIN only', 403, 'FORBIDDEN');
  }
  const data = normalizeCreatePayload(body);
  return Warehouse.create(data);
}

export async function updateWarehouse(warehouseId, body, user) {
  const id = parseUuid(warehouseId, 'warehouseId');
  const data = normalizeUpdatePayload(body);

  const existing = await Warehouse.findById(id);
  if (!existing) {
    throw new AppError('Warehouse not found', 404, 'NOT_FOUND');
  }

  const scoped = getScopedWarehouseId(user);
  if (scoped && scoped !== id) {
    throw new AppError('Forbidden: warehouse out of scope', 403, 'FORBIDDEN');
  }
  if (user?.role === 'WH_ADMIN' && scoped !== id) {
    throw new AppError('Forbidden: warehouse out of scope', 403, 'FORBIDDEN');
  }

  assertWarehouseAreas(data, existing);

  const nextUsable =
    data.usableAreaM2 !== undefined ? parseArea(data.usableAreaM2) : parseArea(existing.usableAreaM2);
  if (nextUsable != null) {
    const used = await sumZoneAreaM2(id);
    if (used > nextUsable) {
      throw new AppError(
        `Tổng diện tích zone (${used} m²) vượt diện tích sử dụng mới (${nextUsable} m²)`,
        400,
        'ZONE_AREA_EXCEEDS_USABLE'
      );
    }
  }

  return Warehouse.updateById(id, data);
}

export async function deleteWarehouse(warehouseId, user) {
  if (user?.role !== 'SYSTEM_ADMIN') {
    throw new AppError('SYSTEM_ADMIN only', 403, 'FORBIDDEN');
  }
  return deleteWarehouseInternal(warehouseId);
}

async function deleteWarehouseInternal(warehouseId) {

  const id = parseUuid(warehouseId, 'warehouseId');
  const deleted = await Warehouse.deleteById(id);
  if (!deleted) {
    throw new AppError('Warehouse not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
