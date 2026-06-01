import Sku from '../models/Sku.js';
import AppError from '../utils/AppError.js';
import {
  MOVEMENT_CATEGORY,
  SKU_STATUS,
} from '../constants/warehouseStructure.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { getCategory } from './category.service.js';
import { getCollection } from './collection.service.js';
import { getSeason } from './season.service.js';
import { getTenantCompany } from './tenantCompany.service.js';
import { getProductKind } from './productKindCatalog.service.js';
import { resolveSizeGroup } from './sizeFactorCatalog.service.js';

const CREATE_FIELDS = [
  'tenantId',
  'skuCode',
  'productName',
  'productKind',
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
  'productKind',
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

async function resolveProductKind(data, { required = false } = {}) {
  if (data.productKind === undefined) {
    if (required) {
      throw new AppError('productKind is required', 400, 'VALIDATION_ERROR');
    }
    return null;
  }

  if (data.productKind === null || data.productKind === '') {
    if (required) {
      throw new AppError('productKind is required', 400, 'VALIDATION_ERROR');
    }
    data.productKind = null;
    return null;
  }

  const code = String(data.productKind).trim().toUpperCase();
  const kind = await getProductKind(code);
  if (kind.status && kind.status !== 'ACTIVE') {
    throw new AppError('productKind is inactive', 400, 'VALIDATION_ERROR');
  }
  data.productKind = code;
  return kind;
}

async function normalizeSkuSize(kind, size) {
  if (!kind || kind.hasSize === false) {
    return null;
  }

  const normalized = String(size ?? '').trim().toUpperCase();
  if (!normalized) {
    throw new AppError('size is required for this product kind', 400, 'VALIDATION_ERROR');
  }

  await resolveSizeGroup({
    size: normalized,
    hasSize: true,
    fieldPrefix: 'size',
  });

  return normalized;
}

async function resolveOptionalFks(data, tenantId) {
  if (data.categoryId !== undefined) {
    if (data.categoryId === null || data.categoryId === '') {
      data.categoryId = null;
    } else {
      await getCategory(data.categoryId);
      data.categoryId = parseUuid(data.categoryId, 'categoryId');
    }
  }
  if (data.collectionId !== undefined) {
    if (data.collectionId === null || data.collectionId === '') {
      data.collectionId = null;
    } else {
      const collection = await getCollection(data.collectionId);
      if (tenantId && collection.tenantId !== tenantId) {
        throw new AppError(
          'collectionId does not belong to this tenant',
          400,
          'VALIDATION_ERROR'
        );
      }
      data.collectionId = parseUuid(data.collectionId, 'collectionId');
    }
  }
  if (data.seasonId !== undefined) {
    if (data.seasonId === null || data.seasonId === '') {
      data.seasonId = null;
    } else {
      await getSeason(data.seasonId);
      data.seasonId = parseUuid(data.seasonId, 'seasonId');
    }
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

  const kind = await resolveProductKind(data, { required: true });
  data.size = await normalizeSkuSize(kind, data.size);

  await resolveOptionalFks(data, data.tenantId);

  return data;
}

async function normalizeUpdatePayload(body, existing) {
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

  let kind = null;
  if (data.productKind !== undefined) {
    kind = await resolveProductKind(data, { required: false });
  } else if (existing.productKind) {
    kind = await getProductKind(existing.productKind);
  }

  if (data.size !== undefined || data.productKind !== undefined) {
    const sizeValue = data.size !== undefined ? data.size : existing.size;
    data.size = await normalizeSkuSize(kind, sizeValue);
  } else if (kind && kind.hasSize === false) {
    data.size = null;
  }

  await resolveOptionalFks(data, existing.tenantId);

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
  const existing = await getSku(id);

  const data = await normalizeUpdatePayload(body, existing);
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
