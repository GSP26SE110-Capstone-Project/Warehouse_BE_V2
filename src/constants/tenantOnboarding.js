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

export const BILLING_CYCLE = Object.freeze(['DAILY', 'MONTHLY', 'QUARTERLY']);

export const TENANT_STATUS = Object.freeze(['ACTIVE', 'SUSPENDED']);
