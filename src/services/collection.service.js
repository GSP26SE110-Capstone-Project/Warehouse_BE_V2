import Collection from '../models/Collection.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { getTenantCompany } from './tenantCompany.service.js';

const CREATE_FIELDS = ['tenantId', 'collectionName'];
const UPDATE_FIELDS = ['collectionName'];

function pickFields(source, fields) {
  const result = {};
  for (const field of fields) {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
  }
  return result;
}

function normalizeName(value, fieldName) {
  const name = String(value ?? '').trim();
  if (!name) {
    throw new AppError(`${fieldName} is required`, 400, 'VALIDATION_ERROR');
  }
  return name;
}

async function findByNameForTenant(tenantId, collectionName, excludeId = null) {
  const rows = await Collection.findAll({ tenantId });
  const normalized = collectionName.trim().toLowerCase();
  return rows.find(
    (row) =>
      row.collectionName?.trim().toLowerCase() === normalized &&
      row.collectionId !== excludeId
  );
}

function normalizeCreatePayload(body) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.tenantId) {
    throw new AppError('tenantId is required', 400, 'VALIDATION_ERROR');
  }

  data.tenantId = parseUuid(data.tenantId, 'tenantId');
  data.collectionName = normalizeName(data.collectionName, 'collectionName');

  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.collectionName != null) {
    data.collectionName = normalizeName(data.collectionName, 'collectionName');
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

export async function getCollection(collectionId) {
  const id = parseUuid(collectionId, 'collectionId');
  const collection = await Collection.findById(id);
  if (!collection) {
    throw new AppError('Collection not found', 404, 'NOT_FOUND');
  }
  return collection;
}

export async function listCollections({ tenantId, page, limit, offset }) {
  const tenantUuid = parseUuid(tenantId, 'tenantId');
  await getTenantCompany(tenantUuid);

  const filters = { tenantId: tenantUuid };

  const [items, total] = await Promise.all([
    Collection.findAll(filters, {
      orderBy: 'collection_name ASC',
      limit,
      offset,
    }),
    Collection.count(filters),
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

export async function createCollection(body) {
  const data = normalizeCreatePayload(body);
  await getTenantCompany(data.tenantId);

  const duplicate = await findByNameForTenant(data.tenantId, data.collectionName);
  if (duplicate) {
    throw new AppError('Collection name already exists for this tenant', 409, 'DUPLICATE');
  }

  return Collection.create(data);
}

export async function updateCollection(collectionId, body) {
  const id = parseUuid(collectionId, 'collectionId');
  const existing = await getCollection(id);

  const data = normalizeUpdatePayload(body);
  if (data.collectionName) {
    const duplicate = await findByNameForTenant(
      existing.tenantId,
      data.collectionName,
      id
    );
    if (duplicate) {
      throw new AppError('Collection name already exists for this tenant', 409, 'DUPLICATE');
    }
  }

  return Collection.updateById(id, data);
}

export async function deleteCollection(collectionId) {
  const id = parseUuid(collectionId, 'collectionId');
  await getCollection(id);

  const deleted = await Collection.deleteById(id);
  if (!deleted) {
    throw new AppError('Collection not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
