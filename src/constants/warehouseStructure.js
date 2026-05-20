export const WAREHOUSE_STATUS = Object.freeze([
  'ACTIVE',
  'INACTIVE',
  'MAINTENANCE',
  'CLOSED',
]);

export const ZONE_TYPE = Object.freeze([
  'SHARED',
  'FAST_MOVING',
  'BULK',
  'PREMIUM',
  'QC',
  'RETURN',
]);

export const ZONE_STATUS = Object.freeze(['ACTIVE', 'BLOCKED']);

export const RACK_TYPE = Object.freeze(['STANDARD', 'HIGH_CAPACITY']);

export const RACK_STATUS = Object.freeze(['ACTIVE', 'BLOCKED']);

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