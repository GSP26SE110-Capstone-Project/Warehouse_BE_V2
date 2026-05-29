import InboundDelivery from '../models/InboundDelivery.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { TENANT_ROLES, WH_TRANSPORT_ROLES } from '../constants/auth.js';
import InboundRequest from '../models/InboundRequest.js';
import { assertInboundStatusTransition } from '../utils/inboundStatus.js';
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

const WAREHOUSE_DISPATCH_ROLES = Object.freeze(['SYSTEM_ADMIN', 'WH_ADMIN', 'WH_STAFF']);

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

function trimOptionalString(value) {
  if (value == null) return value;
  const trimmed = String(value).trim();
  return trimmed || null;
}

async function assertTransporterAssignable(userId, warehouseId) {
  const id = parseUuid(userId, 'assignedDriverUserId');
  const user = await User.findById(id);
  if (!user || user.role !== 'WH_TRANSPORTER') {
    throw new AppError('assignedDriverUserId must be a WH_TRANSPORTER user', 400, 'VALIDATION_ERROR');
  }
  if (user.status !== 'ACTIVE') {
    throw new AppError('Transporter account is not active', 400, 'VALIDATION_ERROR');
  }
  if (user.warehouseId !== warehouseId) {
    throw new AppError('Transporter does not belong to this warehouse', 400, 'VALIDATION_ERROR');
  }
  return id;
}

function assertActorCanManageDelivery(actor, inbound) {
  if (!actor) return;

  if (WH_TRANSPORT_ROLES.includes(actor.role)) {
    throw new AppError('Use transporter delivery update for this role', 403, 'FORBIDDEN');
  }

  if (WAREHOUSE_DISPATCH_ROLES.includes(actor.role)) {
    if (actor.role !== 'SYSTEM_ADMIN' && actor.warehouseId !== inbound.warehouseId) {
      throw new AppError('Forbidden: warehouse out of scope', 403, 'FORBIDDEN');
    }
    return;
  }

  if (TENANT_ROLES.includes(actor.role)) {
    if (actor.tenantId !== inbound.tenantId) {
      throw new AppError('Forbidden: tenant out of scope', 403, 'FORBIDDEN');
    }
    if (inbound.deliveryMode !== 'TENANT_SELF') {
      throw new AppError('Tenant cannot edit warehouse transport delivery', 403, 'FORBIDDEN');
    }
    return;
  }

  throw new AppError('Forbidden', 403, 'FORBIDDEN');
}

function assertTransporterCanAccessDelivery(actor, inbound, delivery) {
  if (!actor || !WH_TRANSPORT_ROLES.includes(actor.role)) {
    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }
  if (actor.warehouseId !== inbound.warehouseId) {
    throw new AppError('Forbidden: warehouse out of scope', 403, 'FORBIDDEN');
  }
  if (inbound.deliveryMode !== 'WAREHOUSE_TRANSPORT') {
    throw new AppError('This inbound is not warehouse transport', 400, 'VALIDATION_ERROR');
  }
  if (!delivery?.assignedDriverUserId || delivery.assignedDriverUserId !== actor.userId) {
    throw new AppError('Trip is not assigned to you', 403, 'FORBIDDEN');
  }
}

function normalizeDispatchPayload(body, { requirePlate }) {
  const data = pickFields(body, UPSERT_FIELDS);

  if (body.assignedDriverUserId !== undefined) {
    data.assignedDriverUserId =
      body.assignedDriverUserId == null || body.assignedDriverUserId === ''
        ? null
        : body.assignedDriverUserId;
  }

  if (data.vehiclePlate != null) {
    data.vehiclePlate = normalizePlate(data.vehiclePlate);
  } else if (requirePlate && body.vehiclePlate !== undefined) {
    data.vehiclePlate = normalizePlate(body.vehiclePlate);
  } else if (requirePlate && !data.assignedDriverUserId) {
    throw new AppError('vehiclePlate is required', 400, 'VALIDATION_ERROR');
  }

  for (const key of ['driverName', 'driverPhone', 'driverIdNumber', 'carrierName', 'notes']) {
    if (data[key] !== undefined) {
      data[key] = trimOptionalString(data[key]);
    }
  }

  if (data.scheduledAt !== undefined) {
    data.scheduledAt = parseDateTimeOptional(data.scheduledAt, 'scheduledAt');
  }

  return data;
}

function normalizeTransporterPayload(body) {
  const data = pickFields(body, UPSERT_FIELDS);

  if (body.assignedDriverUserId !== undefined) {
    throw new AppError('Transporter cannot reassign driver', 403, 'FORBIDDEN');
  }

  if (data.vehiclePlate != null) {
    data.vehiclePlate = normalizePlate(data.vehiclePlate);
  }

  for (const key of ['driverName', 'driverPhone', 'driverIdNumber', 'carrierName', 'notes']) {
    if (data[key] !== undefined) {
      data[key] = trimOptionalString(data[key]);
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

export async function upsertInboundDelivery(inboundRequestId, body, actor = null) {
  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  const inbound = await getInboundRequest(id);

  if (!['PENDING', 'APPROVED', 'ARRIVED'].includes(inbound.status)) {
    throw new AppError(
      `Cannot update delivery info when inbound status is ${inbound.status}`,
      400,
      'INVALID_INBOUND_STATUS'
    );
  }

  const existing = await getInboundDeliveryByRequestId(id);

  if (actor && WH_TRANSPORT_ROLES.includes(actor.role)) {
    assertTransporterCanAccessDelivery(actor, inbound, existing);
    if (!existing) {
      throw new AppError('Delivery record not found for this trip', 404, 'NOT_FOUND');
    }
    const data = normalizeTransporterPayload(body);
    const updated = await InboundDelivery.updateById(existing.inboundDeliveryId, data);
    return updated;
  }

  assertActorCanManageDelivery(actor, inbound);

  if (inbound.deliveryMode === 'WAREHOUSE_TRANSPORT' && TENANT_ROLES.includes(actor?.role)) {
    throw new AppError('Tenant cannot edit warehouse transport delivery', 403, 'FORBIDDEN');
  }

  const requirePlate = !body.assignedDriverUserId && !existing?.vehiclePlate;
  const data = normalizeDispatchPayload(body, {
    requirePlate: requirePlate && body.vehiclePlate !== undefined,
  });

  if (data.assignedDriverUserId) {
    data.assignedDriverUserId = await assertTransporterAssignable(
      data.assignedDriverUserId,
      inbound.warehouseId
    );
  }

  if (existing) {
    if (body.vehiclePlate === undefined && !data.vehiclePlate && !existing.vehiclePlate) {
      if (!data.assignedDriverUserId && !existing.assignedDriverUserId) {
        throw new AppError(
          'vehiclePlate or assignedDriverUserId is required',
          400,
          'VALIDATION_ERROR'
        );
      }
    }
    const updated = await InboundDelivery.updateById(existing.inboundDeliveryId, data);
    if (!updated) {
      throw new AppError('Inbound delivery not found', 404, 'NOT_FOUND');
    }
    return updated;
  }

  if (!data.vehiclePlate && !data.assignedDriverUserId) {
    throw new AppError(
      'vehiclePlate or assignedDriverUserId is required',
      400,
      'VALIDATION_ERROR'
    );
  }

  return InboundDelivery.create({
    inboundRequestId: id,
    tenantId: inbound.tenantId,
    ...data,
  });
}

export async function deleteInboundDelivery(inboundRequestId, actor = null) {
  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  const inbound = await getInboundRequest(id);
  if (actor?.role && WH_TRANSPORT_ROLES.includes(actor.role)) {
    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }
  assertActorCanManageDelivery(actor, inbound);

  const existing = await getInboundDeliveryByRequestId(id);
  if (!existing) {
    throw new AppError('Inbound delivery not found', 404, 'NOT_FOUND');
  }
  return InboundDelivery.deleteById(existing.inboundDeliveryId);
}

export async function reportInboundArrival(inboundRequestId, actor) {
  if (!actor || !WH_TRANSPORT_ROLES.includes(actor.role)) {
    throw new AppError('WH_TRANSPORTER only', 403, 'FORBIDDEN');
  }

  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  const inbound = await getInboundRequest(id);
  const delivery = await getInboundDeliveryByRequestId(id);

  assertTransporterCanAccessDelivery(actor, inbound, delivery);

  if (inbound.status !== 'APPROVED') {
    throw new AppError(
      `Cannot report arrival when inbound status is ${inbound.status}`,
      400,
      'INVALID_INBOUND_STATUS'
    );
  }

  await assertInboundHasDeliveryForGate(id);

  assertInboundStatusTransition(inbound.status, 'ARRIVED');

  return InboundRequest.updateById(id, {
    status: 'ARRIVED',
    actualArrivalAt: new Date(),
    receivedBy: actor.userId,
  });
}
