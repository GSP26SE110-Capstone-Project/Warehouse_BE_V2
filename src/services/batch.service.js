import Batch from '../models/Batch.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { getInboundRequest } from './inboundRequest.service.js';
import { assertInboundAllowsReceivingOps } from '../utils/inboundGuards.js';

const CREATE_FIELDS = ['inboundRequestId', 'batchCode', 'warehouseReceivedAt'];

const UPDATE_FIELDS = ['batchCode', 'warehouseReceivedAt'];

function pickFields(source, fields) {
  const result = {};
  for (const field of fields) {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
  }
  return result;
}

function parseDateTime(value, fieldName) {
  if (value == null || value === '') {
    throw new AppError(`${fieldName} is required`, 400, 'VALIDATION_ERROR');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} is not a valid date-time`, 400, 'VALIDATION_ERROR');
  }
  return date;
}

function normalizeCreatePayload(body) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.inboundRequestId) {
    throw new AppError('inboundRequestId is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.batchCode?.trim()) {
    throw new AppError('batchCode is required', 400, 'VALIDATION_ERROR');
  }

  data.inboundRequestId = parseUuid(data.inboundRequestId, 'inboundRequestId');
  data.batchCode = data.batchCode.trim();
  data.warehouseReceivedAt = parseDateTime(
    data.warehouseReceivedAt ?? new Date().toISOString(),
    'warehouseReceivedAt'
  );

  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.batchCode != null) {
    if (!String(data.batchCode).trim()) {
      throw new AppError('batchCode cannot be empty', 400, 'VALIDATION_ERROR');
    }
    data.batchCode = String(data.batchCode).trim();
  }
  if (data.warehouseReceivedAt != null) {
    data.warehouseReceivedAt = parseDateTime(data.warehouseReceivedAt, 'warehouseReceivedAt');
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

export async function getBatch(batchId) {
  const id = parseUuid(batchId, 'batchId');
  const batch = await Batch.findById(id);
  if (!batch) {
    throw new AppError('Batch not found', 404, 'NOT_FOUND');
  }
  return batch;
}

/** Batch + tenantId from parent inbound request. */
export async function getBatchContext(batchId) {
  const batch = await getBatch(batchId);
  const inbound = await getInboundRequest(batch.inboundRequestId);
  return { batch, tenantId: inbound.tenantId };
}

export async function listBatches({ inboundRequestId, page, limit, offset }) {
  const filters = {};
  if (inboundRequestId) {
    filters.inboundRequestId = parseUuid(inboundRequestId, 'inboundRequestId');
  }

  const [items, total] = await Promise.all([
    Batch.findAll(filters, {
      orderBy: 'warehouse_received_at DESC',
      limit,
      offset,
    }),
    Batch.count(filters),
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

export async function createBatch(body) {
  const data = normalizeCreatePayload(body);
  await assertInboundAllowsReceivingOps(data.inboundRequestId);
  return Batch.create(data);
}

export async function updateBatch(batchId, body) {
  const id = parseUuid(batchId, 'batchId');
  await getBatch(id);

  const data = normalizeUpdatePayload(body);
  return Batch.updateById(id, data);
}

export async function deleteBatch(batchId) {
  const id = parseUuid(batchId, 'batchId');
  await getBatch(id);

  const deleted = await Batch.deleteById(id);
  if (!deleted) {
    throw new AppError('Batch not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
