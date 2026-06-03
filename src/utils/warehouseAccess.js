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
    throw new AppError(
      'Hợp đồng hoặc dữ liệu này thuộc kho khác. Bạn chỉ được thao tác tại kho mình quản lý.',
      403,
      'FORBIDDEN'
    );
  }
}

/** @param {{ tenantId?: string, warehouseId?: string }} contract */
export function assertContractScopeAccess(user, contract) {
  if (!user || !contract) return;

  const scopedTenantId = getScopedTenantId(user);
  if (scopedTenantId) {
    if (contract.tenantId !== scopedTenantId) {
      throw new AppError(
        'Hợp đồng không thuộc công ty của bạn. Bạn không thể xem hoặc xử lý yêu cầu này.',
        403,
        'FORBIDDEN'
      );
    }
    return;
  }

  if (WAREHOUSE_ROLES.includes(user.role)) {
    if (!user.warehouseId) {
      throw new AppError(
        'Tài khoản kho của bạn chưa được gắn với kho làm việc. Vui lòng liên hệ quản trị hệ thống.',
        403,
        'FORBIDDEN'
      );
    }
    assertWarehouseAccess(user, contract.warehouseId);
  }
}

/** Tenant chỉ xem kho đã có hợp đồng (ACTIVE hoặc DRAFT). */
export async function assertTenantWarehouseAccess(user, warehouseId) {
  if (!user || !TENANT_ROLES.includes(user.role)) return;
  const tenantId = user.tenantId;
  if (!tenantId) {
    throw new AppError(
      'Tài khoản tenant chưa được gắn công ty. Vui lòng liên hệ quản trị.',
      403,
      'FORBIDDEN'
    );
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
    throw new AppError(
      'Công ty của bạn chưa có hợp đồng với kho này.',
      403,
      'FORBIDDEN'
    );
  }
}

export function assertSystemAdmin(user) {
  if (user?.role !== 'SYSTEM_ADMIN') {
    throw new AppError('Chỉ quản trị hệ thống mới được thực hiện thao tác này.', 403, 'FORBIDDEN');
  }
}
