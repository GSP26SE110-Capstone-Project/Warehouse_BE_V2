import Warehouse from '../models/Warehouse.js';
import AppError from '../utils/AppError.js';
import { WAREHOUSE_STATUS } from '../constants/warehouseStructure.js';
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

export async function listWarehouses({ status, page, limit, offset }) {
  assertEnum(status, WAREHOUSE_STATUS, 'status');

  const filters = {};
  if (status) filters.status = status;

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

export async function createWarehouse(body) {
  const data = normalizeCreatePayload(body);
  return Warehouse.create(data);
}

export async function updateWarehouse(warehouseId, body) {
  const id = parseUuid(warehouseId, 'warehouseId');
  const data = normalizeUpdatePayload(body);

  const existing = await Warehouse.findById(id);
  if (!existing) {
    throw new AppError('Warehouse not found', 404, 'NOT_FOUND');
  }

  return Warehouse.updateById(id, data);
}

export async function deleteWarehouse(warehouseId) {
  const id = parseUuid(warehouseId, 'warehouseId');
  const deleted = await Warehouse.deleteById(id);
  if (!deleted) {
    throw new AppError('Warehouse not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
