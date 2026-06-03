import {
  BARCODE_CODE_PREFIX,
  BARCODE_ENTITY,
  BARCODE_ENTITY_ALIASES,
  BARCODE_PROTOCOL_VERSION,
  BARCODE_SYMBOLOGY,
} from '../constants/barcode.js';

const NGW1_RE = /^NGW1\|([A-Z_]+)\|(.+)$/i;

export function normalizeScanValue(raw) {
  if (raw == null) return '';
  return String(raw).trim().replace(/\s+/g, '');
}

/**
 * Giá trị in trên tem Code128 — mặc định dùng business code (INB-…, mã LPN, …).
 */
export function buildBarcodeValue(entityType, codeOrId) {
  const code = String(codeOrId ?? '').trim();
  if (!code) return '';

  switch (entityType) {
    case BARCODE_ENTITY.INBOUND_REQUEST:
    case BARCODE_ENTITY.OUTBOUND_REQUEST:
    case BARCODE_ENTITY.LPN:
    case BARCODE_ENTITY.SKU:
    case BARCODE_ENTITY.BIN:
    case BARCODE_ENTITY.BATCH:
      return code;
    default:
      return code;
  }
}

/** Payload có cấu trúc (tùy chọn, tránh trùng mã giữa loại thực thể). */
export function buildStructuredBarcodeValue(entityType, payload) {
  const segment = Object.entries(BARCODE_ENTITY_ALIASES).find(
    ([, v]) => v === entityType
  )?.[0];
  const alias =
    segment === 'INBOUND_REQUEST'
      ? 'INBOUND'
      : segment === 'OUTBOUND_REQUEST'
        ? 'OUTBOUND'
        : segment ?? entityType;
  return `${BARCODE_PROTOCOL_VERSION}|${alias}|${String(payload).trim()}`;
}

export function detectEntityTypeFromBusinessCode(value) {
  const v = value.toUpperCase();
  if (v.startsWith(BARCODE_CODE_PREFIX.INBOUND)) {
    return BARCODE_ENTITY.INBOUND_REQUEST;
  }
  if (v.startsWith(BARCODE_CODE_PREFIX.OUTBOUND)) {
    return BARCODE_ENTITY.OUTBOUND_REQUEST;
  }
  if (v.startsWith(BARCODE_CODE_PREFIX.BATCH)) {
    return BARCODE_ENTITY.BATCH;
  }
  return null;
}

/**
 * @returns {{ symbology: string, format: 'BUSINESS_CODE'|'NGW1', entityType: string|null, lookupKey: string }}
 */
export function parseScanValue(raw) {
  const lookupKey = normalizeScanValue(raw);
  if (!lookupKey) {
    return {
      symbology: BARCODE_SYMBOLOGY,
      format: 'BUSINESS_CODE',
      entityType: null,
      lookupKey: '',
    };
  }

  const structured = lookupKey.match(NGW1_RE);
  if (structured) {
    const alias = structured[1].toUpperCase();
    const payload = structured[2].trim();
    const entityType = BARCODE_ENTITY_ALIASES[alias] ?? null;
    return {
      symbology: BARCODE_SYMBOLOGY,
      format: 'NGW1',
      entityType,
      lookupKey: payload,
    };
  }

  return {
    symbology: BARCODE_SYMBOLOGY,
    format: 'BUSINESS_CODE',
    entityType: detectEntityTypeFromBusinessCode(lookupKey),
    lookupKey,
  };
}

export function barcodeLabelResponse(entityType, businessCode, entityId) {
  const value = buildBarcodeValue(entityType, businessCode);
  return {
    symbology: BARCODE_SYMBOLOGY,
    value,
    structuredValue: buildStructuredBarcodeValue(entityType, businessCode || entityId),
    entityType,
    entityId: entityId ?? null,
    displayCode: businessCode ?? null,
  };
}
