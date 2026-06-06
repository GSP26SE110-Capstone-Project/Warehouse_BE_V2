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
  /** Khách chưa chọn hình thức — WH gán loại thuê khi duyệt */
  'NEEDS_CONSULTATION',
]);

/** Loại thuê có thể ghi trên hợp đồng / billing */
export const BILLABLE_CONTRACT_TYPE = Object.freeze(
  CONTRACT_TYPE.filter((t) => t !== 'NEEDS_CONSULTATION')
);

export const PRICING_MODEL = Object.freeze(['USAGE_BASED', 'FIXED', 'HYBRID']);

/** Chu kỳ billing được phép trên HĐ mới — chỉ MONTHLY. */
export const BILLING_CYCLE = Object.freeze(['MONTHLY']);

export const INVOICE_SOURCE_TYPE = Object.freeze([
  'INBOUND_REQUEST',
  'OUTBOUND_REQUEST',
  'INBOUND_TRANSPORT',
  'OUTBOUND_TRANSPORT',
]);

/** Giá trị enum PostgreSQL (bao gồm legacy). */
export const BILLING_CYCLE_DB = Object.freeze(['DAILY', 'MONTHLY', 'QUARTERLY', 'YEARLY']);

export const TENANT_STATUS = Object.freeze(['ACTIVE', 'SUSPENDED']);

export const CONTRACT_STATUS = Object.freeze([
  'DRAFT',
  'PENDING_APPROVAL',
  'PENDING_PAYMENT',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
  'CANCELLED',
]);

export const INVOICE_CATEGORY = Object.freeze([
  'INITIAL',
  'APPENDIX_INITIAL',
  'RECURRING_RENT',
  'OPERATIONAL',
  'TERMINATION_SETTLEMENT',
]);

export const CONTRACT_APPENDIX_STATUS = Object.freeze([
  'PENDING',
  'UNDER_REVIEW',
  'REJECTED',
  'PENDING_APPROVAL',
  'PENDING_PAYMENT',
  'ACTIVE',
  'TERMINATED',
  'CANCELLED',
  /** @deprecated Dùng PENDING — giữ để đọc bản ghi cũ */
  'DRAFT',
]);

export const TERMINATION_REQUEST_STATUS = Object.freeze([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);

/** Phí xử lý hoàn tiền HĐ yearly chưa inbound (1%). */
export const YEARLY_EARLY_REFUND_PROCESSING_RATE = 0.01;

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
