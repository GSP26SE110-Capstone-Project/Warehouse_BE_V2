export const ROLES = Object.freeze([
  'SYSTEM_ADMIN',
  'WH_ADMIN',
  'WH_STAFF',
  'TENANT_ADMIN',
  'TENANT_STAFF',
]);

export const USER_STATUS = Object.freeze([
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'BLOCKED',
]);

/** role của người tạo → các role được phép tạo */
export const CREATABLE_ROLES = Object.freeze({
  SYSTEM_ADMIN: ['WH_ADMIN', 'TENANT_ADMIN'],
  WH_ADMIN: ['WH_STAFF'],
  TENANT_ADMIN: ['TENANT_STAFF'],
});

export const WAREHOUSE_ROLES = Object.freeze(['WH_ADMIN', 'WH_STAFF']);
export const TENANT_ROLES = Object.freeze(['TENANT_ADMIN', 'TENANT_STAFF']);
