import pool from '../config/db.js';
import User, { userSchema } from '../models/User.js';
import Warehouse from '../models/Warehouse.js';
import TenantCompany from '../models/TenantCompany.js';
import { fromDbRecord } from '../models/utils/fieldMapper.js';
import AppError from '../utils/AppError.js';
import {
  CREATABLE_ROLES,
  ROLES,
  TENANT_ROLES,
  USER_STATUS,
  WAREHOUSE_ROLES,
} from '../constants/auth.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { assertPasswordStrength, hashPassword } from '../utils/password.js';
import { toPublicUser } from '../utils/userPublic.js';
import { pickTransporterSelfUpdate } from '../utils/transporterProfile.js';
import { signPasswordResetToken } from '../config/jwt.js';
import {
  sendTenantAdminWelcomeEmail,
  sendWarehouseAdminWelcomeEmail,
  sendWarehouseStaffWelcomeEmail,
  sendWarehouseTransporterWelcomeEmail,
} from '../config/mail.js';
import { buildLoginUrl, buildPasswordResetUrl } from '../utils/appUrl.js';
import { assertOptionalPhone } from '../utils/phone.js';

/** HĐ còn hiệu lực — chặn vô hiệu hóa WH_ADMIN / TENANT_ADMIN */
const ADMIN_DEACTIVATION_BLOCKING_CONTRACT_STATUSES = Object.freeze([
  'DRAFT',
  'PENDING_APPROVAL',
  'PENDING_PAYMENT',
  'ACTIVE',
]);

async function assertAdminDeactivationAllowed(user) {
  if (!['WH_ADMIN', 'TENANT_ADMIN'].includes(user.role)) return;

  let rows = [];
  if (user.role === 'WH_ADMIN' && user.warehouseId) {
    const result = await pool.query(
      `SELECT contract_code, status, end_date
       FROM contracts
       WHERE warehouse_id = $1
         AND status = ANY($2::contract_status_enum[])
       ORDER BY end_date ASC NULLS LAST
       LIMIT 10`,
      [user.warehouseId, ADMIN_DEACTIVATION_BLOCKING_CONTRACT_STATUSES]
    );
    rows = result.rows;
  } else if (user.role === 'TENANT_ADMIN' && user.tenantId) {
    const result = await pool.query(
      `SELECT contract_code, status, end_date
       FROM contracts
       WHERE tenant_id = $1
         AND status = ANY($2::contract_status_enum[])
       ORDER BY end_date ASC NULLS LAST
       LIMIT 10`,
      [user.tenantId, ADMIN_DEACTIVATION_BLOCKING_CONTRACT_STATUSES]
    );
    rows = result.rows;
  }

  if (rows.length === 0) return;

  const codes = rows
    .map((c) => c.contract_code || '—')
    .slice(0, 5)
    .join(', ');
  const more = rows.length > 5 ? ` (+${rows.length - 5} HĐ khác)` : '';
  const roleLabel = user.role === 'WH_ADMIN' ? 'Warehouse Admin' : 'Tenant Admin';

  throw new AppError(
    `Không thể vô hiệu hóa ${roleLabel} — còn hợp đồng đang hiệu lực (${codes}${more}). Hợp đồng phải hết hạn hoặc được chấm dứt (TERMINATED) trước khi khóa tài khoản.`,
    400,
    'ADMIN_HAS_ACTIVE_CONTRACT'
  );
}

const CREATE_FIELDS = ['fullName', 'email', 'password', 'phone', 'role', 'tenantId', 'warehouseId', 'status'];

const UPDATE_FIELDS = ['fullName', 'phone', 'status'];
const SELF_UPDATE_FIELDS = ['fullName', 'phone'];

function pickFields(source, fields) {
  const result = {};
  for (const field of fields) {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
  }
  return result;
}

function assertCanCreateRole(creatorRole, targetRole) {
  const allowed = CREATABLE_ROLES[creatorRole];
  if (!allowed?.includes(targetRole)) {
    throw new AppError(
      `Role ${creatorRole} cannot create user with role ${targetRole}`,
      403,
      'FORBIDDEN'
    );
  }
}

async function assertWarehouseExists(warehouseId) {
  const id = parseUuid(warehouseId, 'warehouseId');
  const warehouse = await Warehouse.findById(id);
  if (!warehouse) {
    throw new AppError('Warehouse not found', 404, 'NOT_FOUND');
  }
  return id;
}

async function assertTenantExists(tenantId) {
  const id = parseUuid(tenantId, 'tenantId');
  const tenant = await TenantCompany.findById(id);
  if (!tenant) {
    throw new AppError('Tenant not found', 404, 'NOT_FOUND');
  }
  return id;
}

/** Mỗi tenant chỉ được có một tài khoản TENANT_ADMIN */
async function assertUniqueTenantAdminForTenant(tenantId, excludeUserId = null) {
  const tId = parseUuid(tenantId, 'tenantId');
  const values = [tId];
  let sql = `
    SELECT user_id, full_name, email
    FROM users
    WHERE tenant_id = $1
      AND role = 'TENANT_ADMIN'::role_enum
  `;
  if (excludeUserId) {
    values.push(parseUuid(excludeUserId, 'userId'));
    sql += ` AND user_id != $2`;
  }
  const result = await pool.query(sql, values);
  if (result.rows.length > 0) {
    const row = result.rows[0];
    throw new AppError(
      `Tenant đã có Tenant Admin (${row.full_name}, ${row.email}). Mỗi tenant chỉ được một Tenant Admin.`,
      400,
      'TENANT_ADMIN_EXISTS'
    );
  }
}

/** Mỗi kho chỉ được có một tài khoản WH_ADMIN */
async function assertUniqueWhAdminForWarehouse(warehouseId, excludeUserId = null) {
  const whId = parseUuid(warehouseId, 'warehouseId');
  const values = [whId];
  let sql = `
    SELECT user_id, full_name, email, status
    FROM users
    WHERE warehouse_id = $1
      AND role = 'WH_ADMIN'::role_enum
  `;
  if (excludeUserId) {
    values.push(parseUuid(excludeUserId, 'userId'));
    sql += ` AND user_id != $2`;
  }
  const result = await pool.query(sql, values);
  if (result.rows.length > 0) {
    const row = result.rows[0];
    throw new AppError(
      `Kho đã có Warehouse Admin (${row.full_name}, ${row.email}). Mỗi kho chỉ được một WH Admin.`,
      400,
      'WH_ADMIN_EXISTS'
    );
  }
}

function resolveScopeForNewUser(creator, body) {
  const role = body.role;
  let tenantId = null;
  let warehouseId = null;

  if (WAREHOUSE_ROLES.includes(role)) {
    if (creator.role === 'SYSTEM_ADMIN') {
      if (!body.warehouseId) {
        throw new AppError('warehouseId is required for warehouse users', 400, 'VALIDATION_ERROR');
      }
      warehouseId = body.warehouseId;
    } else if (creator.role === 'WH_ADMIN') {
      warehouseId = creator.warehouseId;
      if (!warehouseId) {
        throw new AppError('Creator has no warehouse scope', 403, 'FORBIDDEN');
      }
      if (body.warehouseId && body.warehouseId !== warehouseId) {
        throw new AppError('Cannot assign a different warehouse', 403, 'FORBIDDEN');
      }
    }
    if (body.tenantId) {
      throw new AppError('tenantId is not allowed for warehouse roles', 400, 'VALIDATION_ERROR');
    }
  }

  if (TENANT_ROLES.includes(role)) {
    if (creator.role === 'SYSTEM_ADMIN') {
      if (!body.tenantId) {
        throw new AppError('tenantId is required for tenant users', 400, 'VALIDATION_ERROR');
      }
      tenantId = body.tenantId;
    } else if (creator.role === 'TENANT_ADMIN') {
      tenantId = creator.tenantId;
      if (!tenantId) {
        throw new AppError('Creator has no tenant scope', 403, 'FORBIDDEN');
      }
      if (body.tenantId && body.tenantId !== tenantId) {
        throw new AppError('Cannot assign a different tenant', 403, 'FORBIDDEN');
      }
    }
    if (body.warehouseId) {
      throw new AppError('warehouseId is not allowed for tenant roles', 400, 'VALIDATION_ERROR');
    }
  }

  return { tenantId, warehouseId };
}

function userInCreatorScope(creator, target) {
  if (creator.role === 'SYSTEM_ADMIN') return true;
  if (creator.role === 'WH_ADMIN') {
    return (
      target.warehouseId === creator.warehouseId &&
      ['WH_ADMIN', 'WH_STAFF', 'WH_TRANSPORTER'].includes(target.role)
    );
  }
  if (creator.role === 'TENANT_ADMIN') {
    return (
      target.tenantId === creator.tenantId &&
      ['TENANT_ADMIN', 'TENANT_STAFF'].includes(target.role)
    );
  }
  return creator.userId === target.userId;
}

async function normalizeCreatePayload(body, creator) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.fullName?.trim()) {
    throw new AppError('fullName is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.email?.trim()) {
    throw new AppError('email is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.role) {
    throw new AppError('role is required', 400, 'VALIDATION_ERROR');
  }

  const pwdError = assertPasswordStrength(data.password);
  if (pwdError) {
    throw new AppError(pwdError, 400, 'VALIDATION_ERROR');
  }

  data.fullName = data.fullName.trim();
  data.email = data.email.trim().toLowerCase();
  if (data.phone !== undefined) {
    data.phone = assertOptionalPhone(data.phone, 'phone');
  }
  assertEnum(data.role, ROLES, 'role');
  assertCanCreateRole(creator.role, data.role);

  if (data.status == null) data.status = 'ACTIVE';
  assertEnum(data.status, USER_STATUS, 'status');

  const scope = resolveScopeForNewUser(creator, data);
  if (scope.warehouseId) {
    data.warehouseId = await assertWarehouseExists(scope.warehouseId);
    data.tenantId = null;
    if (data.role === 'WH_ADMIN') {
      await assertUniqueWhAdminForWarehouse(data.warehouseId);
    }
  }
  if (scope.tenantId) {
    data.tenantId = await assertTenantExists(scope.tenantId);
    data.warehouseId = null;
    if (data.role === 'TENANT_ADMIN') {
      await assertUniqueTenantAdminForTenant(data.tenantId);
    }
  }

  data.passwordHash = await hashPassword(data.password);
  delete data.password;

  return data;
}

async function sendWhAdminWelcomeEmail(createdUser, plainPassword, warehouseId) {
  const resetToken = signPasswordResetToken(createdUser.userId);
  const resetPasswordUrl = buildPasswordResetUrl(resetToken);
  const loginUrl = buildLoginUrl();

  let warehouseName = null;
  let warehouseCode = null;
  if (warehouseId) {
    const warehouse = await Warehouse.findById(warehouseId);
    warehouseName = warehouse?.warehouseName ?? null;
    warehouseCode = warehouse?.warehouseCode ?? null;
  }

  return sendWarehouseAdminWelcomeEmail({
    to: createdUser.email,
    fullName: createdUser.fullName,
    email: createdUser.email,
    temporaryPassword: plainPassword,
    warehouseName,
    warehouseCode,
    loginUrl,
    resetPasswordUrl,
  });
}

async function sendWhMemberWelcomeEmail(createdUser, plainPassword, warehouseId, role) {
  const resetToken = signPasswordResetToken(createdUser.userId);
  const resetPasswordUrl = buildPasswordResetUrl(resetToken);
  const loginUrl = buildLoginUrl();

  let warehouseName = null;
  let warehouseCode = null;
  if (warehouseId) {
    const warehouse = await Warehouse.findById(warehouseId);
    warehouseName = warehouse?.warehouseName ?? null;
    warehouseCode = warehouse?.warehouseCode ?? null;
  }

  const sendFn =
    role === 'WH_TRANSPORTER'
      ? sendWarehouseTransporterWelcomeEmail
      : sendWarehouseStaffWelcomeEmail;

  return sendFn({
    to: createdUser.email,
    fullName: createdUser.fullName,
    email: createdUser.email,
    temporaryPassword: plainPassword,
    warehouseName,
    warehouseCode,
    loginUrl,
    resetPasswordUrl,
  });
}

async function sendTenantAdminWelcome(createdUser, plainPassword, tenantId) {
  const resetToken = signPasswordResetToken(createdUser.userId);
  const resetPasswordUrl = buildPasswordResetUrl(resetToken);
  const loginUrl = buildLoginUrl();

  let tenantName = null;
  let tenantCode = null;
  if (tenantId) {
    const tenant = await TenantCompany.findById(tenantId);
    tenantName = tenant?.companyName ?? null;
    tenantCode = tenant?.companyCode ?? tenant?.taxCode ?? null;
  }

  return sendTenantAdminWelcomeEmail({
    to: createdUser.email,
    fullName: createdUser.fullName,
    email: createdUser.email,
    temporaryPassword: plainPassword,
    tenantName,
    tenantCode,
    loginUrl,
    resetPasswordUrl,
  });
}

function buildWelcomeEmailPromise(creator, created, plainPassword, data) {
  if (!plainPassword) return null;

  if (creator.role === 'SYSTEM_ADMIN') {
    if (data.role === 'WH_ADMIN') {
      return sendWhAdminWelcomeEmail(created, plainPassword, data.warehouseId);
    }
    if (data.role === 'TENANT_ADMIN') {
      return sendTenantAdminWelcome(created, plainPassword, data.tenantId);
    }
  }

  if (creator.role === 'WH_ADMIN') {
    if (data.role === 'WH_STAFF' || data.role === 'WH_TRANSPORTER') {
      return sendWhMemberWelcomeEmail(
        created,
        plainPassword,
        data.warehouseId,
        data.role,
      );
    }
  }

  return null;
}

export async function createUser(creator, body) {
  const plainPassword = body.password;
  const data = await normalizeCreatePayload(body, creator);

  let created;
  try {
    created = await User.create(data);
  } catch (err) {
    console.error('[USER] Create user failed:', err);
    throw err;
  }

  const user = toPublicUser(created);
  const welcomeEmailPromise = buildWelcomeEmailPromise(creator, created, plainPassword, data);

  return { user, welcomeEmailPromise };
}

export async function getUserById(creator, userId) {
  const id = parseUuid(userId, 'userId');
  const user = await User.findById(id);
  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }
  if (!userInCreatorScope(creator, user)) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }
  return toPublicUser(user);
}

function mapUserRows(rows) {
  return rows.map((row) => fromDbRecord(userSchema, row));
}

export async function listUsers(creator, { role, status, page, limit, offset }) {
  assertEnum(role, ROLES, 'role');
  assertEnum(status, USER_STATUS, 'status');

  const conditions = [];
  const values = [];
  let n = 1;

  if (creator.role === 'WH_ADMIN') {
    conditions.push(`warehouse_id = $${n++}`);
    values.push(creator.warehouseId);
    conditions.push(`role = ANY($${n++}::role_enum[])`);
    values.push(['WH_ADMIN', 'WH_STAFF', 'WH_TRANSPORTER']);
  } else if (creator.role === 'TENANT_ADMIN') {
    conditions.push(`tenant_id = $${n++}`);
    values.push(creator.tenantId);
    conditions.push(`role = ANY($${n++}::role_enum[])`);
    values.push(['TENANT_ADMIN', 'TENANT_STAFF']);
  }

  if (role) {
    conditions.push(`role = $${n++}::role_enum`);
    values.push(role);
  }
  if (status) {
    conditions.push(`status = $${n++}::user_status_enum`);
    values.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM users ${where}`,
    values
  );
  const total = countResult.rows[0].count;

  const listResult = await pool.query(
    `SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT $${n} OFFSET $${n + 1}`,
    [...values, limit, offset]
  );

  return {
    items: mapUserRows(listResult.rows).map(toPublicUser),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}

async function applySystemAdminScopePatch(creator, existing, body, data) {
  if (creator.role !== 'SYSTEM_ADMIN') return;

  if (body.warehouseId !== undefined) {
    if (!WAREHOUSE_ROLES.includes(existing.role)) {
      throw new AppError(
        'warehouseId can only be set for warehouse roles',
        400,
        'VALIDATION_ERROR'
      );
    }
    if (body.warehouseId === null || body.warehouseId === '') {
      data.warehouseId = null;
      data.tenantId = null;
    } else {
      data.warehouseId = await assertWarehouseExists(body.warehouseId);
      data.tenantId = null;
      if (existing.role === 'WH_ADMIN') {
        await assertUniqueWhAdminForWarehouse(data.warehouseId, existing.userId);
      }
    }
  }

  if (body.tenantId !== undefined) {
    if (!TENANT_ROLES.includes(existing.role)) {
      throw new AppError(
        'tenantId can only be set for tenant roles',
        400,
        'VALIDATION_ERROR'
      );
    }
    data.tenantId = await assertTenantExists(body.tenantId);
    data.warehouseId = null;
    if (existing.role === 'TENANT_ADMIN') {
      await assertUniqueTenantAdminForTenant(data.tenantId, existing.userId);
    }
  }
}

export async function updateSelfProfile(currentUser, body) {
  const data =
    currentUser.role === 'WH_TRANSPORTER'
      ? pickTransporterSelfUpdate(body)
      : pickFields(body, SELF_UPDATE_FIELDS);
  if (data.fullName != null) {
    data.fullName = String(data.fullName).trim();
    if (!data.fullName) {
      throw new AppError('fullName cannot be empty', 400, 'VALIDATION_ERROR');
    }
  }
  if (data.phone !== undefined) {
    data.phone = assertOptionalPhone(data.phone, 'phone');
  }
  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }
  const updated = await User.updateById(currentUser.userId, data);
  return toPublicUser(updated);
}

export async function updateUser(creator, userId, body) {
  const id = parseUuid(userId, 'userId');
  const existing = await User.findById(id);
  if (!existing) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }
  if (!userInCreatorScope(creator, existing)) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  const data = pickFields(body, UPDATE_FIELDS);
  if (data.fullName != null) {
    data.fullName = String(data.fullName).trim();
    if (!data.fullName) {
      throw new AppError('fullName cannot be empty', 400, 'VALIDATION_ERROR');
    }
  }
  if (data.phone !== undefined) {
    data.phone = assertOptionalPhone(data.phone, 'phone');
  }
  assertEnum(data.status, USER_STATUS, 'status');

  await applySystemAdminScopePatch(creator, existing, body, data);

  if (
    data.status !== undefined &&
    data.status !== 'ACTIVE' &&
    creator.userId === id
  ) {
    throw new AppError(
      'Cannot deactivate your own account',
      403,
      'FORBIDDEN'
    );
  }

  if (creator.role !== 'SYSTEM_ADMIN' && data.status === 'ACTIVE' && existing.status === 'BLOCKED') {
    throw new AppError('Cannot reactivate blocked user', 403, 'FORBIDDEN');
  }

  if (
    data.status !== undefined &&
    data.status !== 'ACTIVE' &&
    existing.status === 'ACTIVE'
  ) {
    await assertAdminDeactivationAllowed(existing);
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  const updated = await User.updateById(id, data);
  return toPublicUser(updated);
}
