import StorageReservation, { storageReservationSchema } from '../models/StorageReservation.js';
import { fromDbRecord } from '../models/utils/fieldMapper.js';
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

  const dateOverlapSql = `daterange(start_date, end_date, '[)') && daterange($2::date, $3::date, '[)')`;

  // SHARED pool (zone/kho chung): nhiều tenant có thể cùng dùng — chỉ chặn khi có lock DEDICATED
  if (data.reservationType === 'SHARED') {
    if (data.storageLevel === 'ZONE' && data.zoneId) {
      const dedicatedLock = await StorageReservation.queryOne(
        `SELECT reservation_id, tenant_id
         FROM storage_reservations
         WHERE status = 'ACTIVE'
           AND zone_id = $1
           AND ${dateOverlapSql}
           AND reservation_type = 'DEDICATED'
         LIMIT 1`,
        [data.zoneId, data.startDate, data.endDate]
      );
      if (dedicatedLock) {
        throw new AppError(
          'Zone này đang được cấp riêng (DEDICATED) cho tenant khác trong khoảng thời gian này',
          409,
          'ZONE_ALREADY_ASSIGNED'
        );
      }
    }
    if (data.storageLevel === 'WAREHOUSE' && data.warehouseId) {
      const dedicatedWh = await StorageReservation.queryOne(
        `SELECT reservation_id
         FROM storage_reservations
         WHERE status = 'ACTIVE'
           AND warehouse_id = $1
           AND storage_level = 'WAREHOUSE'
           AND ${dateOverlapSql}
           AND reservation_type = 'DEDICATED'
         LIMIT 1`,
        [data.warehouseId, data.startDate, data.endDate]
      );
      if (dedicatedWh) {
        throw new AppError(
          'Kho này đang được cấp riêng (DEDICATED) cho tenant khác trong khoảng thời gian này',
          409,
          'RESERVATION_CONFLICT'
        );
      }
    }
    return;
  }

  // RESERVED bin / slot cố định: một bin chỉ một tenant trong kỳ
  if (data.reservationType === 'RESERVED' || data.storageLevel === 'BIN') {
    const binConflict = await StorageReservation.queryOne(
      `SELECT reservation_id, tenant_id
       FROM storage_reservations
       WHERE status = 'ACTIVE'
         AND ${targetField} = $1
         AND tenant_id != $4
         AND ${dateOverlapSql}
       LIMIT 1`,
      [targetId, data.startDate, data.endDate, data.tenantId]
    );
    if (binConflict) {
      throw new AppError(
        'Bin/slot này đã được cấp cho tenant khác trong khoảng thời gian này',
        409,
        'RESERVATION_CONFLICT'
      );
    }
    return;
  }

  // DEDICATED: độc quyền — không tenant khác được trùng vị trí trong kỳ
  if (data.reservationType === 'DEDICATED') {
    const otherTenant = await StorageReservation.queryOne(
      `SELECT reservation_id, tenant_id, reservation_type
       FROM storage_reservations
       WHERE status = 'ACTIVE'
         AND ${targetField} = $1
         AND tenant_id != $4
         AND ${dateOverlapSql}
       LIMIT 1`,
      [targetId, data.startDate, data.endDate, data.tenantId]
    );
    if (otherTenant) {
      throw new AppError(
        data.storageLevel === 'ZONE'
          ? 'Zone này đã được cấp cho tenant khác trong khoảng thời gian này'
          : 'Vị trí lưu trữ đã được cấp cho tenant khác trong khoảng thời gian này',
        409,
        data.storageLevel === 'ZONE' ? 'ZONE_ALREADY_ASSIGNED' : 'RESERVATION_CONFLICT'
      );
    }
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

function mapReservationListRow(row) {
  const base = fromDbRecord(storageReservationSchema, row) ?? {};
  return {
    ...base,
    warehouseCode: row.warehouse_code ?? null,
    warehouseName: row.warehouse_name ?? null,
    zoneCode: row.zone_code ?? null,
    zoneName: row.zone_name ?? null,
    rackCode: row.rack_code ?? null,
    levelNumber:
      row.level_number != null && row.level_number !== ''
        ? Number(row.level_number)
        : null,
    binCode: row.bin_code ?? null,
  };
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

  const clauses = [];
  const values = [];
  const addClause = (sql, value) => {
    values.push(value);
    clauses.push(`${sql} = $${values.length}`);
  };
  if (contractId) addClause('sr.contract_id', parseUuid(contractId, 'contractId'));
  if (tenantId) addClause('sr.tenant_id', parseUuid(tenantId, 'tenantId'));
  if (warehouseId) addClause('sr.warehouse_id', parseUuid(warehouseId, 'warehouseId'));
  if (zoneId) addClause('sr.zone_id', parseUuid(zoneId, 'zoneId'));
  if (rackId) addClause('sr.rack_id', parseUuid(rackId, 'rackId'));
  if (rackLevelId) addClause('sr.rack_level_id', parseUuid(rackLevelId, 'rackLevelId'));
  if (binId) addClause('sr.bin_id', parseUuid(binId, 'binId'));
  if (storageLevel) addClause('sr.storage_level', storageLevel);
  if (status) addClause('sr.status', status);

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const paginationValues = [...values];
  const limitVal = limit ?? 100;
  const offsetVal = offset ?? 0;
  paginationValues.push(limitVal, offsetVal);

  const rows = await StorageReservation.query(
    `SELECT sr.*,
            w.warehouse_code,
            w.warehouse_name,
            z.zone_code,
            z.zone_name,
            r.rack_code,
            rl.level_number,
            b.bin_code
     FROM storage_reservations sr
     LEFT JOIN warehouses w ON w.warehouse_id = sr.warehouse_id
     LEFT JOIN warehouse_zones z ON z.zone_id = sr.zone_id
     LEFT JOIN racks r ON r.rack_id = sr.rack_id
     LEFT JOIN rack_levels rl ON rl.rack_level_id = sr.rack_level_id
     LEFT JOIN bins b ON b.bin_id = sr.bin_id
     ${whereSql}
     ORDER BY sr.created_at DESC
     LIMIT $${paginationValues.length - 1}
     OFFSET $${paginationValues.length}`,
    paginationValues
  );
  const items = rows.map(mapReservationListRow);
  const totalRow = await StorageReservation.queryOne(
    `SELECT COUNT(*)::int AS count
     FROM storage_reservations sr
     ${whereSql}`,
    values
  );
  const total = totalRow?.count ?? 0;

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
