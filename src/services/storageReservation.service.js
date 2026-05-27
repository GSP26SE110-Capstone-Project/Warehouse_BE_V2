import StorageReservation from '../models/StorageReservation.js';
import AppError from '../utils/AppError.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import {
  RESERVATION_STATUS,
  STORAGE_LEVEL,
} from '../constants/tenantOnboarding.js';
import { BOX_TYPE, RESERVATION_TYPE } from '../constants/warehouseStructure.js';
import { getContract } from './contract.service.js';
import { getWarehouseById } from './warehouse.service.js';
import { getZone } from './warehouseZone.service.js';
import { getRack } from './rack.service.js';
import { getRackLevel } from './rackLevel.service.js';
import { getBin } from './bin.service.js';

const CREATE_FIELDS = [
  'reservationType',
  'storageLevel',
  'warehouseId',
  'zoneId',
  'rackId',
  'rackLevelId',
  'binId',
  'reservedCapacity',
  'boxType',
  'startDate',
  'endDate',
  'status',
];

const UPDATE_FIELDS = [
  'reservationType',
  'reservedCapacity',
  'boxType',
  'startDate',
  'endDate',
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

function parseDateOnly(value, fieldName) {
  if (value == null) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} is not a valid date`, 400, 'VALIDATION_ERROR');
  }
  return date;
}

function parseNonNegativeNumber(value, fieldName) {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new AppError(
      `${fieldName} must be a non-negative number`,
      400,
      'VALIDATION_ERROR'
    );
  }
  return n;
}

function validateEnums(data) {
  assertEnum(data.reservationType, RESERVATION_TYPE, 'reservationType');
  assertEnum(data.storageLevel, STORAGE_LEVEL, 'storageLevel');
  assertEnum(data.boxType, BOX_TYPE, 'boxType');
  assertEnum(data.status, RESERVATION_STATUS, 'status');
}

const LEVEL_REQUIRED_FK = {
  WAREHOUSE: ['warehouseId'],
  ZONE: ['warehouseId', 'zoneId'],
  RACK: ['warehouseId', 'rackId'],
  RACK_LEVEL: ['warehouseId', 'rackLevelId'],
  BIN: ['warehouseId', 'binId'],
};

const LEVEL_TARGET_FIELD = {
  WAREHOUSE: 'warehouse_id',
  ZONE: 'zone_id',
  RACK: 'rack_id',
  RACK_LEVEL: 'rack_level_id',
  BIN: 'bin_id',
};

async function validateStorageTarget(data) {
  const required = LEVEL_REQUIRED_FK[data.storageLevel];
  for (const field of required) {
    if (!data[field]) {
      throw new AppError(
        `${field} is required when storageLevel = ${data.storageLevel}`,
        400,
        'VALIDATION_ERROR'
      );
    }
  }

  if (data.warehouseId) {
    data.warehouseId = parseUuid(data.warehouseId, 'warehouseId');
    await getWarehouseById(data.warehouseId);
  }
  if (data.zoneId) {
    data.zoneId = parseUuid(data.zoneId, 'zoneId');
    await getZone(data.zoneId);
  }
  if (data.rackId) {
    data.rackId = parseUuid(data.rackId, 'rackId');
    await getRack(data.rackId);
  }
  if (data.rackLevelId) {
    data.rackLevelId = parseUuid(data.rackLevelId, 'rackLevelId');
    await getRackLevel(data.rackLevelId);
  }
  if (data.binId) {
    data.binId = parseUuid(data.binId, 'binId');
    await getBin(data.binId);
  }
}

async function normalizeCreatePayload(body, contractId, tenantId) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.reservationType) {
    throw new AppError('reservationType is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.storageLevel) {
    throw new AppError('storageLevel is required', 400, 'VALIDATION_ERROR');
  }
  if (data.startDate == null) {
    throw new AppError('startDate is required', 400, 'VALIDATION_ERROR');
  }
  if (data.endDate == null) {
    throw new AppError('endDate is required', 400, 'VALIDATION_ERROR');
  }

  data.startDate = parseDateOnly(data.startDate, 'startDate');
  data.endDate = parseDateOnly(data.endDate, 'endDate');
  if (data.startDate >= data.endDate) {
    throw new AppError('endDate must be after startDate', 400, 'VALIDATION_ERROR');
  }

  if (data.reservedCapacity !== undefined)
    data.reservedCapacity = parseNonNegativeNumber(
      data.reservedCapacity,
      'reservedCapacity'
    );

  if (data.status == null) data.status = 'ACTIVE';

  validateEnums(data);
  await validateStorageTarget(data);

  data.contractId = contractId;
  data.tenantId = tenantId;
  return data;
}

async function assertNoOverlappingReservation(data) {
  const targetField = LEVEL_TARGET_FIELD[data.storageLevel];
  if (!targetField) return;

  const targetId =
    data.storageLevel === 'WAREHOUSE'
      ? data.warehouseId
      : data.storageLevel === 'ZONE'
        ? data.zoneId
        : data.storageLevel === 'RACK'
          ? data.rackId
          : data.storageLevel === 'RACK_LEVEL'
            ? data.rackLevelId
            : data.binId;
  if (!targetId) return;

  const conflicting = await StorageReservation.queryOne(
    `SELECT reservation_id, contract_id, tenant_id, start_date, end_date
     FROM storage_reservations
     WHERE status = 'ACTIVE'
       AND ${targetField} = $1
       AND daterange(start_date, end_date, '[)') && daterange($2::date, $3::date, '[)')
     LIMIT 1`,
    [targetId, data.startDate, data.endDate]
  );

  if (conflicting) {
    throw new AppError(
      'Vị trí lưu trữ đã được cấp cho tenant khác trong khoảng thời gian này',
      409,
      'RESERVATION_CONFLICT'
    );
  }
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.startDate !== undefined)
    data.startDate = parseDateOnly(data.startDate, 'startDate');
  if (data.endDate !== undefined) data.endDate = parseDateOnly(data.endDate, 'endDate');
  if (data.startDate && data.endDate && data.startDate >= data.endDate) {
    throw new AppError('endDate must be after startDate', 400, 'VALIDATION_ERROR');
  }

  if (data.reservedCapacity !== undefined)
    data.reservedCapacity = parseNonNegativeNumber(
      data.reservedCapacity,
      'reservedCapacity'
    );

  validateEnums(data);

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }
  return data;
}

export async function getStorageReservation(reservationId) {
  const id = parseUuid(reservationId, 'reservationId');
  const reservation = await StorageReservation.findById(id);
  if (!reservation) {
    throw new AppError('Storage reservation not found', 404, 'NOT_FOUND');
  }
  return reservation;
}

export async function listStorageReservations({
  contractId,
  tenantId,
  warehouseId,
  zoneId,
  rackId,
  rackLevelId,
  binId,
  storageLevel,
  status,
  page,
  limit,
  offset,
}) {
  assertEnum(storageLevel, STORAGE_LEVEL, 'storageLevel');
  assertEnum(status, RESERVATION_STATUS, 'status');

  const filters = {};
  if (contractId) filters.contractId = parseUuid(contractId, 'contractId');
  if (tenantId) filters.tenantId = parseUuid(tenantId, 'tenantId');
  if (warehouseId) filters.warehouseId = parseUuid(warehouseId, 'warehouseId');
  if (zoneId) filters.zoneId = parseUuid(zoneId, 'zoneId');
  if (rackId) filters.rackId = parseUuid(rackId, 'rackId');
  if (rackLevelId) filters.rackLevelId = parseUuid(rackLevelId, 'rackLevelId');
  if (binId) filters.binId = parseUuid(binId, 'binId');
  if (storageLevel) filters.storageLevel = storageLevel;
  if (status) filters.status = status;

  const [items, total] = await Promise.all([
    StorageReservation.findAll(filters, {
      orderBy: 'created_at DESC',
      limit,
      offset,
    }),
    StorageReservation.count(filters),
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

export async function createStorageReservation(contractId, body) {
  const cId = parseUuid(contractId, 'contractId');
  const contract = await getContract(cId);

  const data = await normalizeCreatePayload(body, cId, contract.tenantId);
  await assertNoOverlappingReservation(data);
  return StorageReservation.create(data);
}

export async function updateStorageReservation(reservationId, body) {
  const id = parseUuid(reservationId, 'reservationId');
  await getStorageReservation(id);

  const data = normalizeUpdatePayload(body);
  return StorageReservation.updateById(id, data);
}

export async function deleteStorageReservation(reservationId) {
  const id = parseUuid(reservationId, 'reservationId');
  await getStorageReservation(id);

  const deleted = await StorageReservation.deleteById(id);
  if (!deleted) {
    throw new AppError('Storage reservation not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
