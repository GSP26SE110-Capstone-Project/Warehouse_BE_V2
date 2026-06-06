import WarehouseZone from '../models/WarehouseZone.js';
import AppError from '../utils/AppError.js';
import { ZONE_STATUS, ZONE_TYPE } from '../constants/warehouseStructure.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import {
  REFERENCE_ZONE_AREA_M2,
  computeZoneStorageCapacity,
} from '../constants/warehouseCapacity.js';
import { maxLpnsPerBinSlotForZone } from '../constants/binCapacityDefaults.js';
import { assertWarehouseAccess } from '../utils/warehouseAccess.js';
import { getWarehouseById, getWarehouseZonePlanning } from './warehouse.service.js';

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

async function enrichZonesWithLayoutStats(zones) {
  if (!zones.length) return [];

  const zoneIds = zones.map((z) => z.zoneId);
  const rackRows = await WarehouseZone.query(
    `SELECT zone_id, COUNT(*)::int AS rack_count
     FROM racks
     WHERE zone_id = ANY($1::uuid[])
       AND status = 'ACTIVE'
     GROUP BY zone_id`,
    [zoneIds]
  );
  const rackCountByZone = new Map(
    rackRows.map((row) => [row.zone_id, Number(row.rack_count) || 0])
  );

  return zones.map((zone) => {
    const cap = computeZoneStorageCapacity(zone.areaM2);
    const rackCount = rackCountByZone.get(zone.zoneId) ?? 0;
    return {
      ...zone,
      rackCount,
      maxRacks: cap.maxRacks,
      totalBinSlots: cap.totalBinSlots,
      estimatedLpnCapacity: cap.totalBinSlots * maxLpnsPerBinSlotForZone(zone.zoneType),
    };
  });
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
      `Tổng diện tích zone (${sum} m²) vượt diện tích sử dụng kho (${usable} m²)`,
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

export async function listZones(warehouseId, { status, zoneType, page, limit, offset }, user) {
  const whId = parseUuid(warehouseId, 'warehouseId');
  assertWarehouseAccess(user, whId);
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

  const enrichedItems = await enrichZonesWithLayoutStats(items);

  return {
    items: enrichedItems,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}

export async function createZone(warehouseId, body, user) {
  const whId = parseUuid(warehouseId, 'warehouseId');
  assertWarehouseAccess(user, whId);
  await getWarehouseById(whId);

  const data = normalizeCreatePayload(body, whId);
  if (data.areaM2 != null) {
    await assertZoneAreaWithinWarehouse(whId, data.areaM2);
  }
  return WarehouseZone.create(data);
}

export async function createZonesBulk(warehouseId, body, user) {
  const whId = parseUuid(warehouseId, 'warehouseId');
  assertWarehouseAccess(user, whId);
  await getWarehouseById(whId);

  const zoneType = body.zoneType ?? 'SHARED';
  const isDedicated = body.isDedicated ?? false;
  const status = body.status ?? 'ACTIVE';
  const codePrefix = (body.zoneCodePrefix ?? 'Z').trim() || 'Z';

  let zonesToCreate = [];

  if (Array.isArray(body.zones) && body.zones.length > 0) {
    zonesToCreate = body.zones.map((z, i) => ({
      zoneCode: String(z.zoneCode ?? `${codePrefix}-${String(i + 1).padStart(2, '0')}`).trim(),
      zoneName: z.zoneName != null ? String(z.zoneName).trim() : undefined,
      areaM2: z.areaM2 != null ? Number(z.areaM2) : null,
    }));
  } else {
    const count = Number(body.count);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      throw new AppError('count must be between 1 and 50', 400, 'VALIDATION_ERROR');
    }
    const planning = await getWarehouseZonePlanning(whId);
    const areaEach =
      body.areaM2PerZone != null
        ? Number(body.areaM2PerZone)
        : planning.suggestedAreaPerZoneForEvenSplit ?? REFERENCE_ZONE_AREA_M2;

    if (!Number.isFinite(areaEach) || areaEach <= 0) {
      throw new AppError('areaM2PerZone must be a positive number', 400, 'VALIDATION_ERROR');
    }

    const existing = await WarehouseZone.findAll({ warehouseId: whId });
    const startIndex = existing.length + 1;
    zonesToCreate = Array.from({ length: count }, (_, i) => ({
      zoneCode: `${codePrefix}-${String(startIndex + i).padStart(2, '0')}`,
      zoneName: body.zoneNamePrefix
        ? `${String(body.zoneNamePrefix).trim()} ${startIndex + i}`
        : undefined,
      areaM2: areaEach,
    }));
  }

  const created = [];
  for (const z of zonesToCreate) {
    if (!z.zoneCode) {
      throw new AppError('zoneCode is required for each zone', 400, 'VALIDATION_ERROR');
    }
    const payload = normalizeCreatePayload(
      {
        zoneCode: z.zoneCode,
        zoneName: z.zoneName,
        zoneType,
        areaM2: z.areaM2,
        isDedicated,
        status,
      },
      whId
    );
    if (payload.areaM2 != null) {
      await assertZoneAreaWithinWarehouse(whId, payload.areaM2);
    }
    created.push(await WarehouseZone.create(payload));
  }

  return { items: created, count: created.length };
}

export async function updateZone(zoneId, body, user) {
  const id = parseUuid(zoneId, 'zoneId');
  const zone = await getZone(id);
  assertWarehouseAccess(user, zone.warehouseId);

  const data = normalizeUpdatePayload(body);
  const nextArea = data.areaM2 !== undefined ? data.areaM2 : zone.areaM2;
  if (nextArea != null) {
    await assertZoneAreaWithinWarehouse(zone.warehouseId, nextArea, id);
  }
  return WarehouseZone.updateById(id, data);
}

export async function getZoneForUser(zoneId, user) {
  const zone = await getZone(zoneId);
  assertWarehouseAccess(user, zone.warehouseId);
  return zone;
}

export async function deleteZone(zoneId, user) {
  const id = parseUuid(zoneId, 'zoneId');
  const zone = await getZone(id);
  assertWarehouseAccess(user, zone.warehouseId);

  const deleted = await WarehouseZone.deleteById(id);
  if (!deleted) {
    throw new AppError('Zone not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
