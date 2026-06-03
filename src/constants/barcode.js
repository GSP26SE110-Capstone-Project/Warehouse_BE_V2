/** Barcode chuẩn cho mobile WH staff — symbology Code 128 (subset B, ASCII printable). */

export const BARCODE_SYMBOLOGY = Object.freeze('CODE128');

/** Phiên bản prefix có cấu trúc: `NGW1|ENTITY|payload` */
export const BARCODE_PROTOCOL_VERSION = Object.freeze('NGW1');

export const BARCODE_ENTITY = Object.freeze({
  INBOUND_REQUEST: 'INBOUND_REQUEST',
  OUTBOUND_REQUEST: 'OUTBOUND_REQUEST',
  LPN: 'LPN',
  SKU: 'SKU',
  BIN: 'BIN',
  BATCH: 'BATCH',
});

/** Alias trong chuỗi NGW1 (segment 2). */
export const BARCODE_ENTITY_ALIASES = Object.freeze({
  INBOUND: BARCODE_ENTITY.INBOUND_REQUEST,
  INBOUND_REQUEST: BARCODE_ENTITY.INBOUND_REQUEST,
  OUTBOUND: BARCODE_ENTITY.OUTBOUND_REQUEST,
  OUTBOUND_REQUEST: BARCODE_ENTITY.OUTBOUND_REQUEST,
  LPN: BARCODE_ENTITY.LPN,
  SKU: BARCODE_ENTITY.SKU,
  BIN: BARCODE_ENTITY.BIN,
  BATCH: BARCODE_ENTITY.BATCH,
});

/** Prefix mã nghiệp vụ (auto-detect khi không có NGW1). */
export const BARCODE_CODE_PREFIX = Object.freeze({
  INBOUND: 'INB-',
  OUTBOUND: 'OUT-',
  BATCH: 'BATCH-',
});
