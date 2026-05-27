import AppError from './AppError.js';
import { WAREHOUSE_ROLES } from '../constants/auth.js';

export function getScopedWarehouseId(user) {
  if (!user) return null;
  if (WAREHOUSE_ROLES.includes(user.role)) {
    return user.warehouseId ?? null;
  }
  return null;
}

export function assertWarehouseAccess(user, warehouseId) {
  const scoped = getScopedWarehouseId(user);
  if (scoped && scoped !== warehouseId) {
    throw new AppError('Forbidden: warehouse out of scope', 403, 'FORBIDDEN');
  }
}

export function assertSystemAdmin(user) {
  if (user?.role !== 'SYSTEM_ADMIN') {
    throw new AppError('SYSTEM_ADMIN only', 403, 'FORBIDDEN');
  }
}
