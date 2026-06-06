export const OUTBOUND_STATUS_TRANSITIONS = Object.freeze({
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['APPROVED', 'CANCELLED'],
  APPROVED: ['RESERVED', 'CANCELLED'],
  RESERVED: ['PICKING', 'CANCELLED'],
  PICKING: ['PACKING', 'CANCELLED'],
  PACKING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
});

export const WH_OUTBOUND_ROLES = Object.freeze([
  'SYSTEM_ADMIN',
  'WH_ADMIN',
  'WH_STAFF',
]);

/** Duyệt phiếu, gán picker, duyệt packing (ship), hoàn tất. */
export const WH_ADMIN_OUTBOUND_ROLES = Object.freeze(['SYSTEM_ADMIN', 'WH_ADMIN']);

/** Thực hiện pick (chỉ khi được gán trên picking task). */
export const WH_STAFF_PICK_ROLES = Object.freeze(['WH_STAFF']);

export const TENANT_OUTBOUND_ROLES = Object.freeze(['TENANT_ADMIN', 'TENANT_STAFF']);
