import SizeFactorCatalog from '../models/SizeFactorCatalog.js';
import { CATALOG_STATUS, SIZE_GROUP_CODE } from '../constants/productCatalog.js';
import AppError from '../utils/AppError.js';
import { assertEnum } from '../utils/validate.js';

let sizeLookupCache = null;
let sizeLookupLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

function normalizeStatus(status) {
  if (status == null || status === '') return 'ACTIVE';
  assertEnum(status, CATALOG_STATUS, 'status');
  return status;
}

async function loadSizeLookup() {
  const now = Date.now();
  if (sizeLookupCache && now - sizeLookupLoadedAt < CACHE_TTL_MS) {
    return sizeLookupCache;
  }

  const rows = await SizeFactorCatalog.findAll(
    { status: 'ACTIVE' },
    { orderBy: 'sort_order ASC' }
  );

  const byGroup = new Map();
  const sizeToGroup = new Map();

  for (const row of rows) {
    byGroup.set(row.sizeGroup, row);
    const sizes = Array.isArray(row.sizes) ? row.sizes : [];
    for (const size of sizes) {
      sizeToGroup.set(String(size).trim().toUpperCase(), row.sizeGroup);
    }
  }

  sizeLookupCache = { byGroup, sizeToGroup, rows };
  sizeLookupLoadedAt = now;
  return sizeLookupCache;
}

export async function listSizeFactors({ status } = {}) {
  const filters = {};
  if (status) filters.status = normalizeStatus(status);

  return SizeFactorCatalog.findAll(filters, {
    orderBy: 'sort_order ASC, size_group ASC',
  });
}

export async function getSizeFactor(sizeGroup) {
  const code = String(sizeGroup ?? '').trim().toUpperCase();
  assertEnum(code, SIZE_GROUP_CODE, 'sizeGroup');

  const item = await SizeFactorCatalog.findById(code);
  if (!item) {
    throw new AppError('Size group not found', 404, 'NOT_FOUND');
  }

  return item;
}

export async function resolveSizeGroup({ size, sizeGroup, hasSize = true, fieldPrefix = '' }) {
  const label = fieldPrefix ? `${fieldPrefix}.` : '';

  if (!hasSize) {
    return 'M_L';
  }

  if (sizeGroup != null && sizeGroup !== '') {
    const code = String(sizeGroup).trim().toUpperCase();
    assertEnum(code, SIZE_GROUP_CODE, `${label}sizeGroup`);
    return code;
  }

  if (size != null && String(size).trim() !== '') {
    const normalized = String(size).trim().toUpperCase();
    const lookup = await loadSizeLookup();
    const group = lookup.sizeToGroup.get(normalized);
    if (!group) {
      throw new AppError(
        `${label}size "${size}" is not in the size catalog (XS–S / M–L / XL–3XL)`,
        400,
        'VALIDATION_ERROR'
      );
    }
    return group;
  }

  throw new AppError(
    `${label}size or sizeGroup is required for sized products`,
    400,
    'VALIDATION_ERROR'
  );
}

export async function getSizeFactorValue(sizeGroup) {
  const lookup = await loadSizeLookup();
  const row = lookup.byGroup.get(sizeGroup);
  if (!row) {
    throw new AppError('Size group not found', 404, 'NOT_FOUND');
  }
  return Number(row.factor);
}

export function clearSizeFactorCache() {
  sizeLookupCache = null;
  sizeLookupLoadedAt = 0;
}
