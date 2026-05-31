export const WAREHOUSE_STATUS = Object.freeze([
  'ACTIVE',
  'INACTIVE',
  'MAINTENANCE',
  'CLOSED',
]);

export const ZONE_TYPE = Object.freeze(['SHARED', 'FAST_MOVING', 'PREMIUM', 'PRIVATE']);

export const ZONE_STATUS = Object.freeze(['ACTIVE', 'BLOCKED']);

/** Kho quần áo: chỉ rack tiêu chuẩn */
export const RACK_TYPE = Object.freeze(['STANDARD']);

export const RACK_STATUS = Object.freeze(['ACTIVE', 'BLOCKED']);

/** Rack quần áo: cố định 3 tầng / rack */
export const RACK_FIXED_LEVEL_COUNT = 3;

export const BOX_TYPE = Object.freeze(['SMALL', 'MEDIUM', 'LARGE', 'EXTRA']);

/** Volume units per box type (base unit = SMALL). */
export const BOX_VOLUME_UNITS = Object.freeze({
  SMALL: 1,
  MEDIUM: 2,
  LARGE: 4,
  EXTRA: 8,
});

export const LPN_STATUS = Object.freeze([
  'RECEIVING',
  'STORED',
  'PICKED',
  'SHIPPED',
  'DAMAGED',
]);

export const MOVEMENT_CATEGORY = Object.freeze(['FAST', 'NORMAL', 'SLOW']);

export const SKU_STATUS = Object.freeze(['ACTIVE', 'INACTIVE']);

export const BIN_STATUS = Object.freeze([
  'EMPTY',
  'PARTIAL',
  'FULL',
  'RESERVED',
  'BLOCKED',
]);

export const RESERVATION_TYPE = Object.freeze(['SHARED', 'RESERVED', 'DEDICATED']);