import InboundDelivery from '../models/InboundDelivery.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { getInboundRequest } from './inboundRequest.service.js';

const UPSERT_FIELDS = [
  'vehiclePlate',
  'driverName',
  'driverPhone',
  'driverIdNumber',
  'carrierName',
  'scheduledAt',
  'notes',
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

function parseDateTimeOptional(value, fieldName) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} is not a valid date-time`, 400, 'VALIDATION_ERROR');
  }
  return date;
}

function normalizePlate(plate) {
  const normalized = String(plate ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!normalized) {
    throw new AppError('vehiclePlate is required', 400, 'VALIDATION_ERROR');
  }
  if (normalized.length > 32) {
    throw new AppError('vehiclePlate is too long', 400, 'VALIDATION_ERROR');
  }
  return normalized;
}

function normalizeUpsertPayload(body) {
  const data = pickFields(body, UPSERT_FIELDS);

  if (body.vehiclePlate === undefined && !data.vehiclePlate) {
    throw new AppError('vehiclePlate is required', 400, 'VALIDATION_ERROR');
  }
  if (data.vehiclePlate != null) {
    data.vehiclePlate = normalizePlate(data.vehiclePlate);
  }

  for (const key of ['driverName', 'driverPhone', 'driverIdNumber', 'carrierName', 'notes']) {
    if (data[key] != null) {
      const trimmed = String(data[key]).trim();
      data[key] = trimmed || null;
    }
  }

  if (data.scheduledAt !== undefined) {
    data.scheduledAt = parseDateTimeOptional(data.scheduledAt, 'scheduledAt');
  }

  return data;
}

export async function getInboundDeliveryByRequestId(inboundRequestId) {
  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  const rows = await InboundDelivery.findAll({ inboundRequestId: id });
  return rows[0] ?? null;
}

export async function assertInboundHasDeliveryForGate(inboundRequestId) {
  const delivery = await getInboundDeliveryByRequestId(inboundRequestId);
  if (!delivery?.vehiclePlate?.trim()) {
    throw new AppError(
      'Vehicle plate is required before marking arrival. Save inbound delivery info first.',
      400,
      'DELIVERY_INFO_REQUIRED'
    );
  }
  return delivery;
}

export async function upsertInboundDelivery(inboundRequestId, body) {
  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  const inbound = await getInboundRequest(id);

  if (!['PENDING', 'APPROVED', 'ARRIVED'].includes(inbound.status)) {
    throw new AppError(
      `Cannot update delivery info when inbound status is ${inbound.status}`,
      400,
      'INVALID_INBOUND_STATUS'
    );
  }

  const data = normalizeUpsertPayload(body);
  const existing = await getInboundDeliveryByRequestId(id);

  if (existing) {
    const updated = await InboundDelivery.updateById(existing.inboundDeliveryId, data);
    if (!updated) {
      throw new AppError('Inbound delivery not found', 404, 'NOT_FOUND');
    }
    return updated;
  }

  if (!data.vehiclePlate) {
    throw new AppError('vehiclePlate is required', 400, 'VALIDATION_ERROR');
  }

  return InboundDelivery.create({
    inboundRequestId: id,
    tenantId: inbound.tenantId,
    ...data,
  });
}

export async function deleteInboundDelivery(inboundRequestId) {
  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  await getInboundRequest(id);
  const existing = await getInboundDeliveryByRequestId(id);
  if (!existing) {
    throw new AppError('Inbound delivery not found', 404, 'NOT_FOUND');
  }
  const deleted = await InboundDelivery.deleteById(existing.inboundDeliveryId);
  return deleted;
}
