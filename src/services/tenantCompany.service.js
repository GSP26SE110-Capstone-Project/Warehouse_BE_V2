import TenantCompany from '../models/TenantCompany.js';
import User from '../models/User.js';
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

  if (data.contactEmail != null) {
    data.contactEmail = String(data.contactEmail).trim().toLowerCase();
    if (!data.contactEmail) {
      throw new AppError('contactEmail cannot be empty', 400, 'VALIDATION_ERROR');
    }
  }

  assertEnum(data.status, TENANT_STATUS, 'status');

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

function normalizeContactEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

/** contactEmail không được trùng bất kỳ users.email nào (kể cả WH_ADMIN). */
async function assertContactEmailNotRegisteredAsUser(contactEmail) {
  const normalized = normalizeContactEmail(contactEmail);
  if (!normalized) return;

  const existingUser = await User.queryOne(
    `SELECT user_id FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
    [normalized]
  );
  if (!existingUser) return;

  throw new AppError(
    'Email liên hệ không được trùng email tài khoản đã có trên hệ thống (kể cả quản trị kho). Vui lòng dùng email công ty khác.',
    409,
    'GUEST_TENANT_EMAIL_USER_EXISTS'
  );
}

/** contactEmail unique giữa các tenant (trừ tenant đang cập nhật). */
async function assertContactEmailNotUsedByOtherTenant(contactEmail, excludeTenantId = null) {
  const normalized = normalizeContactEmail(contactEmail);
  if (!normalized) return;

  const params = [normalized];
  let excludeClause = '';
  if (excludeTenantId) {
    params.push(excludeTenantId);
    excludeClause = ' AND tenant_id != $2';
  }

  const existingTenant = await TenantCompany.queryOne(
    `SELECT tenant_id FROM tenant_companies
     WHERE LOWER(TRIM(contact_email)) = $1${excludeClause}
     LIMIT 1`,
    params
  );
  if (!existingTenant) return;

  throw new AppError(
    `Email liên hệ "${normalized}" đã được dùng đăng ký trước đó. Tra cứu bằng mã RR + email hoặc gửi lại form với đúng email này để tạo yêu cầu mới.`,
    409,
    'GUEST_TENANT_EMAIL_EXISTS'
  );
}

export async function getTenantCompany(tenantId) {
  const id = parseUuid(tenantId, 'tenantId');
  const tenant = await TenantCompany.findById(id);
  if (!tenant) {
    throw new AppError('Tenant company not found', 404, 'NOT_FOUND');
  }
  return tenant;
}

/** Tra cứu tenant theo email liên hệ (guest onboarding / login hint). */
export async function findTenantCompanyByContactEmail(email) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const row = await TenantCompany.queryOne(
    `SELECT *
     FROM tenant_companies
     WHERE LOWER(TRIM(contact_email)) = $1
     LIMIT 1`,
    [normalizedEmail]
  );

  return row ? fromDbRecord(tenantCompanySchema, row) : null;
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
  await assertContactEmailNotRegisteredAsUser(data.contactEmail);
  await assertContactEmailNotUsedByOtherTenant(data.contactEmail);
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

  await assertContactEmailNotRegisteredAsUser(data.contactEmail);

  const tenant = await TenantCompany.create(data);
  return { ...tenant, reusedExistingProfile: false };
}

export async function updateTenantCompany(tenantId, body) {
  const id = parseUuid(tenantId, 'tenantId');
  await getTenantCompany(id);

  const data = normalizeUpdatePayload(body);
  if (data.contactEmail != null) {
    await assertContactEmailNotRegisteredAsUser(data.contactEmail);
    await assertContactEmailNotUsedByOtherTenant(data.contactEmail, id);
  }
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
