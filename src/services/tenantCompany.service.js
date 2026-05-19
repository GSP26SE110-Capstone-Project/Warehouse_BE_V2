import TenantCompany from '../models/TenantCompany.js';
import AppError from '../utils/AppError.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { TENANT_STATUS } from '../constants/tenantOnboarding.js';

const CREATE_FIELDS = [
  'companyName',
  'companyCode',
  'taxCode',
  'contactName',
  'contactEmail',
  'contactPhone',
  'address',
  'status',
];

const UPDATE_FIELDS = [
  'companyName',
  'companyCode',
  'taxCode',
  'contactName',
  'contactEmail',
  'contactPhone',
  'address',
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

function trimStrings(data, fields) {
  for (const field of fields) {
    if (data[field] != null) {
      data[field] = String(data[field]).trim();
    }
  }
}

function normalizeCreatePayload(body) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.companyName?.trim()) {
    throw new AppError('companyName is required', 400, 'VALIDATION_ERROR');
  }

  trimStrings(data, [
    'companyName',
    'companyCode',
    'taxCode',
    'contactName',
    'contactEmail',
    'contactPhone',
    'address',
  ]);

  if (data.status == null) data.status = 'ACTIVE';
  assertEnum(data.status, TENANT_STATUS, 'status');

  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.companyName != null) {
    data.companyName = String(data.companyName).trim();
    if (!data.companyName) {
      throw new AppError('companyName cannot be empty', 400, 'VALIDATION_ERROR');
    }
  }

  trimStrings(data, [
    'companyCode',
    'taxCode',
    'contactName',
    'contactEmail',
    'contactPhone',
    'address',
  ]);

  assertEnum(data.status, TENANT_STATUS, 'status');

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

export async function getTenantCompany(tenantId) {
  const id = parseUuid(tenantId, 'tenantId');
  const tenant = await TenantCompany.findById(id);
  if (!tenant) {
    throw new AppError('Tenant company not found', 404, 'NOT_FOUND');
  }
  return tenant;
}

export async function listTenantCompanies({ status, page, limit, offset }) {
  assertEnum(status, TENANT_STATUS, 'status');

  const filters = {};
  if (status) filters.status = status;

  const [items, total] = await Promise.all([
    TenantCompany.findAll(filters, {
      orderBy: 'created_at DESC',
      limit,
      offset,
    }),
    TenantCompany.count(filters),
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

export async function createTenantCompany(body) {
  const data = normalizeCreatePayload(body);
  return TenantCompany.create(data);
}

export async function updateTenantCompany(tenantId, body) {
  const id = parseUuid(tenantId, 'tenantId');
  await getTenantCompany(id);

  const data = normalizeUpdatePayload(body);
  return TenantCompany.updateById(id, data);
}

export async function deleteTenantCompany(tenantId) {
  const id = parseUuid(tenantId, 'tenantId');
  await getTenantCompany(id);

  const deleted = await TenantCompany.deleteById(id);
  if (!deleted) {
    throw new AppError('Tenant company not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
