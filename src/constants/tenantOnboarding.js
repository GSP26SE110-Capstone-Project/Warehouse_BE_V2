export const RENTAL_REQUEST_STATUS = Object.freeze([
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CONVERTED',
]);

export const CONTRACT_TYPE = Object.freeze([
  'SHARED_STORAGE',
  'RESERVED_STORAGE',
  'DEDICATED_ZONE',
  'DEDICATED_WAREHOUSE',
]);

export const PRICING_MODEL = Object.freeze(['USAGE_BASED', 'FIXED', 'HYBRID']);

export const BILLING_CYCLE = Object.freeze(['DAILY', 'MONTHLY', 'QUARTERLY', 'YEARLY']);

export const TENANT_STATUS = Object.freeze(['ACTIVE', 'SUSPENDED']);

export const CONTRACT_STATUS = Object.freeze([
  'DRAFT',
  'PENDING_APPROVAL',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
  'CANCELLED',
]);

export const BILLING_UNIT = Object.freeze([
  'BOX_DAY',
  'BIN_DAY',
  'RACK_DAY',
  'ZONE_DAY',
  'WAREHOUSE_DAY',
  'INBOUND_LPN',
  'OUTBOUND_LPN',
  'HANDLING_UNIT',
]);

export const INVOICE_ITEM_TYPE = Object.freeze([
  'STORAGE',
  'INBOUND',
  'OUTBOUND',
  'HANDLING',
  'REPACKING',
  'SLA',
]);

export const STORAGE_LEVEL = Object.freeze([
  'WAREHOUSE',
  'ZONE',
  'RACK',
  'RACK_LEVEL',
  'BIN',
]);

export const RESERVATION_STATUS = Object.freeze(['ACTIVE', 'EXPIRED', 'CANCELLED']);
