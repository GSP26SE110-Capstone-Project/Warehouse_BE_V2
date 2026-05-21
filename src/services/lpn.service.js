import Lpn from '../models/Lpn.js';
import AppError from '../utils/AppError.js';
import {
  BOX_TYPE,
  BOX_VOLUME_UNITS,
  LPN_STATUS,
} from '../constants/warehouseStructure.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { getBatchContext } from './batch.service.js';
import { getBin } from './bin.service.js';
import { getTenantCompany } from './tenantCompany.service.js';

const CREATE_FIELDS = [
  'tenantId',
  'batchId',
  'lpnCode',
  'boxType',
  'volumeUnits',
  'maxCapacity',
  'actualQuantity',
  'fillPercentage',
  'weightKg',
  'currentBinId',
  'status',
];

const UPDATE_FIELDS = [
  'boxType',
  'volumeUnits',
  'maxCapacity',
  'actualQuantity',
  'fillPercentage',
  'weightKg',
  'currentBinId',
  'status',
];

function pickFields(source, fields) {
  const result = {};
  for (const field of fields) {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
  }
  return result;
}

function parsePositiveInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new AppError(`${fieldName} must be a positive integer`, 400, 'VALIDATION_ERROR');
  }
  return n;
}

function parseNonNegativeInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new AppError(`${fieldName} must be a non-negative integer`, 400, 'VALIDATION_ERROR');
  }
  return n;
}

function parseFillPercentage(value) {
  const n = Number(value);
  if (Number.isNaN(n) || n < 0 || n > 100) {
    throw new AppError('fillPercentage must be between 0 and 100', 400, 'VALIDATION_ERROR');
  }
  return n;
}

function parseOptionalWeightKg(value) {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) {
    throw new AppError('weightKg must be a non-negative number', 400, 'VALIDATION_ERROR');
  }
  return n;
}

function resolveVolumeUnits(boxType, volumeUnits) {
  const expected = BOX_VOLUME_UNITS[boxType];
  if (volumeUnits == null || volumeUnits === '') {
    return expected;
  }
  const n = Number(volumeUnits);
  if (!Number.isInteger(n) || n < 1) {
    throw new AppError('volumeUnits must be a positive integer', 400, 'VALIDATION_ERROR');
  }
  if (n !== expected) {
    throw new AppError(
      `volumeUnits must be ${expected} for boxType ${boxType}`,
      400,
      'VALIDATION_ERROR'
    );
  }
  return n;
}

async function assertTenantMatchesBatch(tenantId, batchId) {
  const tenantUuid = parseUuid(tenantId, 'tenantId');
  await getTenantCompany(tenantUuid);
  const { tenantId: batchTenantId } = await getBatchContext(batchId);
  if (batchTenantId !== tenantUuid) {
    throw new AppError('tenantId does not match batch inbound tenant', 400, 'VALIDATION_ERROR');
  }
  return tenantUuid;
}

async function normalizeCreatePayload(body) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.tenantId) {
    throw new AppError('tenantId is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.batchId) {
    throw new AppError('batchId is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.lpnCode?.trim()) {
    throw new AppError('lpnCode is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.boxType) {
    throw new AppError('boxType is required', 400, 'VALIDATION_ERROR');
  }

  data.lpnCode = data.lpnCode.trim();
  data.batchId = parseUuid(data.batchId, 'batchId');
  await assertTenantMatchesBatch(data.tenantId, data.batchId);
  data.tenantId = parseUuid(data.tenantId, 'tenantId');

  assertEnum(data.boxType, BOX_TYPE, 'boxType');
  data.volumeUnits = resolveVolumeUnits(data.boxType, data.volumeUnits);

  if (data.maxCapacity != null) {
    data.maxCapacity = parsePositiveInt(data.maxCapacity, 'maxCapacity');
  }
  if (data.actualQuantity == null) data.actualQuantity = 0;
  else data.actualQuantity = parseNonNegativeInt(data.actualQuantity, 'actualQuantity');

  if (data.fillPercentage != null) {
    data.fillPercentage = parseFillPercentage(data.fillPercentage);
  }

  if (data.weightKg != null) {
    data.weightKg = parseOptionalWeightKg(data.weightKg);
  }

  if (data.currentBinId != null) {
    data.currentBinId = parseUuid(data.currentBinId, 'currentBinId');
    await getBin(data.currentBinId);
  }

  if (data.status == null) data.status = 'RECEIVING';
  assertEnum(data.status, LPN_STATUS, 'status');

  return data;
}

async function normalizeUpdatePayload(body, existing) {
  const data = pickFields(body, UPDATE_FIELDS);

  const boxType = data.boxType ?? existing.boxType;
  if (data.boxType != null) {
    assertEnum(data.boxType, BOX_TYPE, 'boxType');
  }

  if (data.volumeUnits !== undefined || data.boxType != null) {
    const volumeInput =
      data.volumeUnits !== undefined
        ? data.volumeUnits
        : data.boxType != null
          ? null
          : existing.volumeUnits;
    data.volumeUnits = resolveVolumeUnits(boxType, volumeInput);
  }
  if (data.boxType != null) {
    data.boxType = boxType;
  }

  if (data.maxCapacity != null) {
    data.maxCapacity = parsePositiveInt(data.maxCapacity, 'maxCapacity');
  }
  if (data.actualQuantity != null) {
    data.actualQuantity = parseNonNegativeInt(data.actualQuantity, 'actualQuantity');
  }
  if (data.fillPercentage != null) {
    data.fillPercentage = parseFillPercentage(data.fillPercentage);
  }

  if (data.weightKg !== undefined) {
    if (data.weightKg === null || data.weightKg === '') {
      data.weightKg = null;
    } else {
      data.weightKg = parseOptionalWeightKg(data.weightKg);
    }
  }

  if (data.currentBinId !== undefined) {
    if (data.currentBinId === null || data.currentBinId === '') {
      data.currentBinId = null;
    } else {
      data.currentBinId = parseUuid(data.currentBinId, 'currentBinId');
      await getBin(data.currentBinId);
    }
  }

  assertEnum(data.status, LPN_STATUS, 'status');

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

export async function getLpn(lpnId) {
  const id = parseUuid(lpnId, 'lpnId');
  const lpn = await Lpn.findById(id);
  if (!lpn) {
    throw new AppError('LPN not found', 404, 'NOT_FOUND');
  }
  return lpn;
}

export async function listLpns({
  tenantId,
  batchId,
  status,
  boxType,
  currentBinId,
  page,
  limit,
  offset,
}) {
  assertEnum(status, LPN_STATUS, 'status');
  assertEnum(boxType, BOX_TYPE, 'boxType');

  const filters = {};
  if (tenantId) filters.tenantId = parseUuid(tenantId, 'tenantId');
  if (batchId) filters.batchId = parseUuid(batchId, 'batchId');
  if (status) filters.status = status;
  if (boxType) filters.boxType = boxType;
  if (currentBinId) filters.currentBinId = parseUuid(currentBinId, 'currentBinId');

  const [items, total] = await Promise.all([
    Lpn.findAll(filters, {
      orderBy: 'created_at DESC',
      limit,
      offset,
    }),
    Lpn.count(filters),
  ]);

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}

export async function createLpn(body) {
  const data = await normalizeCreatePayload(body);
  return Lpn.create(data);
}

export async function updateLpn(lpnId, body) {
  const id = parseUuid(lpnId, 'lpnId');
  const existing = await getLpn(id);
  const data = await normalizeUpdatePayload(body, existing);
  return Lpn.updateById(id, data);
}

export async function deleteLpn(lpnId) {
  const id = parseUuid(lpnId, 'lpnId');
  await getLpn(id);

  const deleted = await Lpn.deleteById(id);
  if (!deleted) {
    throw new AppError('LPN not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
