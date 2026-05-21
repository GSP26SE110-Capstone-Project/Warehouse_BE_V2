import Sku from '../models/Sku.js';
import Category from '../models/Category.js';
import Collection from '../models/Collection.js';
import Season from '../models/Season.js';
import AppError from '../utils/AppError.js';
import {
  MOVEMENT_CATEGORY,
  SKU_STATUS,
} from '../constants/warehouseStructure.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { getTenantCompany } from './tenantCompany.service.js';

const CREATE_FIELDS = [
  'tenantId',
  'skuCode',
  'productName',
  'categoryId',
  'collectionId',
  'seasonId',
  'color',
  'size',
  'material',
  'movementCategory',
  'status',
];

const UPDATE_FIELDS = [
  'skuCode',
  'productName',
  'categoryId',
  'collectionId',
  'seasonId',
  'color',
  'size',
  'material',
  'movementCategory',
  'status',
];

const TRIM_FIELDS = [
  'skuCode',
  'productName',
  'color',
  'size',
  'material',
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

function trimStrings(data, fields) {
  for (const field of fields) {
    if (data[field] != null) {
      data[field] = String(data[field]).trim();
    }
  }
}

async function assertOptionalFk(Model, id, fieldName) {
  if (id == null || id === '') return null;
  const uuid = parseUuid(id, fieldName);
  const row = await Model.findById(uuid);
  if (!row) {
    throw new AppError(`${fieldName} not found`, 404, 'NOT_FOUND');
  }
  return uuid;
}

async function resolveOptionalFks(data) {
  if (data.categoryId !== undefined) {
    data.categoryId =
      data.categoryId === null
        ? null
        : await assertOptionalFk(Category, data.categoryId, 'categoryId');
  }
  if (data.collectionId !== undefined) {
    data.collectionId =
      data.collectionId === null
        ? null
        : await assertOptionalFk(Collection, data.collectionId, 'collectionId');
  }
  if (data.seasonId !== undefined) {
    data.seasonId =
      data.seasonId === null
        ? null
        : await assertOptionalFk(Season, data.seasonId, 'seasonId');
  }
  return data;
}

async function normalizeCreatePayload(body) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.tenantId) {
    throw new AppError('tenantId is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.skuCode?.trim()) {
    throw new AppError('skuCode is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.productName?.trim()) {
    throw new AppError('productName is required', 400, 'VALIDATION_ERROR');
  }

  data.tenantId = parseUuid(data.tenantId, 'tenantId');
  await getTenantCompany(data.tenantId);

  trimStrings(data, TRIM_FIELDS);

  if (data.movementCategory == null) data.movementCategory = 'NORMAL';
  if (data.status == null) data.status = 'ACTIVE';

  assertEnum(data.movementCategory, MOVEMENT_CATEGORY, 'movementCategory');
  assertEnum(data.status, SKU_STATUS, 'status');

  await resolveOptionalFks(data);

  return data;
}

async function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.skuCode != null) {
    data.skuCode = String(data.skuCode).trim();
    if (!data.skuCode) {
      throw new AppError('skuCode cannot be empty', 400, 'VALIDATION_ERROR');
    }
  }
  if (data.productName != null) {
    data.productName = String(data.productName).trim();
    if (!data.productName) {
      throw new AppError('productName cannot be empty', 400, 'VALIDATION_ERROR');
    }
  }

  trimStrings(data, ['color', 'size', 'material']);

  assertEnum(data.movementCategory, MOVEMENT_CATEGORY, 'movementCategory');
  assertEnum(data.status, SKU_STATUS, 'status');

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  await resolveOptionalFks(data);

  return data;
}

export async function getSku(skuId) {
  const id = parseUuid(skuId, 'skuId');
  const sku = await Sku.findById(id);
  if (!sku) {
    throw new AppError('SKU not found', 404, 'NOT_FOUND');
  }
  return sku;
}

export async function listSkus({ tenantId, status, movementCategory, page, limit, offset }) {
  const tenantUuid = parseUuid(tenantId, 'tenantId');
  await getTenantCompany(tenantUuid);

  assertEnum(status, SKU_STATUS, 'status');
  assertEnum(movementCategory, MOVEMENT_CATEGORY, 'movementCategory');

  const filters = { tenantId: tenantUuid };
  if (status) filters.status = status;
  if (movementCategory) filters.movementCategory = movementCategory;

  const [items, total] = await Promise.all([
    Sku.findAll(filters, {
      orderBy: 'sku_code ASC',
      limit,
      offset,
    }),
    Sku.count(filters),
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

export async function createSku(body) {
  const data = await normalizeCreatePayload(body);
  return Sku.create(data);
}

export async function updateSku(skuId, body) {
  const id = parseUuid(skuId, 'skuId');
  await getSku(id);

  const data = await normalizeUpdatePayload(body);
  return Sku.updateById(id, data);
}

export async function deleteSku(skuId) {
  const id = parseUuid(skuId, 'skuId');
  await getSku(id);

  const deleted = await Sku.deleteById(id);
  if (!deleted) {
    throw new AppError('SKU not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
