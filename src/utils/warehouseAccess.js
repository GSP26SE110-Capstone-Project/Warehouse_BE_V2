import pool from '../config/db.js';
import AppError from './AppError.js';
import { TENANT_ROLES, WAREHOUSE_ROLES } from '../constants/auth.js';
import { parseUuid } from './validate.js';

export function getScopedWarehouseId(user) {
  if (!user) return null;
  if (WAREHOUSE_ROLES.includes(user.role)) {
    return user.warehouseId ?? null;
  }
  return null;
}

export function getScopedTenantId(user) {
  if (!user) return null;
  if (TENANT_ROLES.includes(user.role)) {
    return user.tenantId ?? null;
  }
  return null;
}

export function assertWarehouseAccess(user, warehouseId) {
  const scoped = getScopedWarehouseId(user);
  if (scoped && scoped !== warehouseId) {
    throw new AppError('Forbidden: warehouse out of scope', 403, 'FORBIDDEN');
  }
}

/** Tenant chỉ xem kho đã có hợp đồng (ACTIVE hoặc DRAFT). */
export async function assertTenantWarehouseAccess(user, warehouseId) {
  if (!user || !TENANT_ROLES.includes(user.role)) return;
  const tenantId = user.tenantId;
  if (!tenantId) {
    throw new AppError('Tenant user missing tenantId', 403, 'FORBIDDEN');
  }
  const whId = parseUuid(warehouseId, 'warehouseId');
  const row = await pool.query(
    `SELECT 1
     FROM contracts
     WHERE tenant_id = $1
       AND warehouse_id = $2
       AND status IN ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE')
     LIMIT 1`,
    [tenantId, whId]
  );
  if (!row.rows[0]) {
    throw new AppError('Forbidden: no contract with this warehouse', 403, 'FORBIDDEN');
  }
}

export function assertSystemAdmin(user) {
  if (user?.role !== 'SYSTEM_ADMIN') {
    throw new AppError('SYSTEM_ADMIN only', 403, 'FORBIDDEN');
  }
}
