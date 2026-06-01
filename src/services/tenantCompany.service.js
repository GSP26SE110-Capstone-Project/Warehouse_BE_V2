import TenantCompany from '../models/TenantCompany.js';
import AppError from '../utils/AppError.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { TENANT_STATUS } from '../constants/tenantOnboarding.js';
import { fromDbRecord } from '../models/utils/fieldMapper.js';
import { tenantCompanySchema } from '../models/TenantCompany.js';

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

  if (!data.contactEmail?.trim()) {
    throw new AppError('contactEmail is required', 400, 'VALIDATION_ERROR');
  }
  data.contactEmail = data.contactEmail.trim().toLowerCase();

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

/**
 * Guest landing — tái sử dụng tenant theo email liên hệ nếu đã đăng ký trước (chưa cần account).
 */
export async function resolveOrCreateGuestTenant(body) {
  const data = normalizeCreatePayload(body);

  const existingByEmail = await TenantCompany.queryOne(
    `SELECT *
     FROM tenant_companies
     WHERE LOWER(TRIM(contact_email)) = LOWER(TRIM($1))
     LIMIT 1`,
    [data.contactEmail]
  );

  if (existingByEmail) {
    const tenant = fromDbRecord(tenantCompanySchema, existingByEmail);
    return { ...tenant, reusedExistingProfile: true };
  }

  if (data.taxCode) {
    const existingByTax = await TenantCompany.queryOne(
      `SELECT tc.*, tc.contact_email AS existing_email
       FROM tenant_companies tc
       WHERE LOWER(TRIM(tax_code)) = LOWER(TRIM($1))
       LIMIT 1`,
      [data.taxCode]
    );
    if (existingByTax) {
      const maskedEmail = String(existingByTax.existing_email ?? '').trim();
      throw new AppError(
        maskedEmail
          ? `Mã số thuế này đã đăng ký với email ${maskedEmail}. Dùng email đó để gửi yêu cầu mới hoặc tra cứu mã RR + email bên cạnh form.`
          : 'Mã số thuế này đã được đăng ký. Vui lòng dùng email liên hệ đã đăng ký trước đó.',
        409,
        'GUEST_TENANT_TAX_EXISTS'
      );
    }
  }

  const tenant = await TenantCompany.create(data);
  return { ...tenant, reusedExistingProfile: false };
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
