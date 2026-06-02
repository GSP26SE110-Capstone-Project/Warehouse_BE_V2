import InboundDelivery from '../models/InboundDelivery.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { TENANT_ROLES, WH_TRANSPORT_ROLES } from '../constants/auth.js';
import InboundRequest from '../models/InboundRequest.js';
import { assertInboundStatusTransition } from '../utils/inboundStatus.js';
import { getInboundRequest } from './inboundRequest.service.js';
import { applyTransporterProfileToDelivery } from '../utils/transporterProfile.js';
import {
  notifyInboundArrivalReported,
  notifyTenantAdminTransportAssigned,
} from './inboundNotify.service.js';

const UPSERT_FIELDS = [
  'vehiclePlate',
  'driverName',
  'driverPhone',
  'driverIdNumber',
  'carrierName',
  'scheduledAt',
  'notes',
];

const PICKUP_FIELDS = [
  'pickupAddress',
  'pickupContactName',
  'pickupContactPhone',
  'pickupNotes',
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
    if (inbound.deliveryMode === 'TENANT_SELF') {
      return;
    }
    if (inbound.deliveryMode === 'WAREHOUSE_TRANSPORT') {
      return;
    }
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

function normalizePickupPayload(body, { requireAddress = false } = {}) {
  const data = pickFields(body, PICKUP_FIELDS);

  if (data.pickupAddress !== undefined) {
    const addr = trimOptionalString(data.pickupAddress);
    if (requireAddress && !addr) {
      throw new AppError('pickupAddress is required', 400, 'VALIDATION_ERROR');
    }
    data.pickupAddress = addr;
  } else if (requireAddress) {
    throw new AppError('pickupAddress is required', 400, 'VALIDATION_ERROR');
  }

  for (const key of ['pickupContactName', 'pickupContactPhone', 'pickupNotes']) {
    if (data[key] !== undefined) {
      data[key] = trimOptionalString(data[key]);
    }
  }

  if (requireAddress && !data.pickupContactName) {
    throw new AppError('pickupContactName is required', 400, 'VALIDATION_ERROR');
  }
  if (requireAddress && !data.pickupContactPhone) {
    throw new AppError('pickupContactPhone is required', 400, 'VALIDATION_ERROR');
  }

  return data;
}

async function fireTransportAssignedNotify(inbound, delivery, previousAssignedDriverUserId) {
  if (!delivery?.assignedDriverUserId) return;
  try {
    await notifyTenantAdminTransportAssigned({
      inbound,
      delivery,
      previousAssignedDriverUserId,
    });
  } catch {
    /* email optional — không chặn lưu delivery */
  }
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
  const previousAssignedDriverUserId = existing?.assignedDriverUserId ?? null;

  if (actor && WH_TRANSPORT_ROLES.includes(actor.role)) {
    assertTransporterCanAccessDelivery(actor, inbound, existing);
    if (!existing) {
      throw new AppError('Delivery record not found for this trip', 404, 'NOT_FOUND');
    }
    const data = normalizeTransporterPayload(body);
    return InboundDelivery.updateById(existing.inboundDeliveryId, data);
  }

  if (
    actor &&
    TENANT_ROLES.includes(actor.role) &&
    inbound.deliveryMode === 'WAREHOUSE_TRANSPORT'
  ) {
    if (actor.tenantId !== inbound.tenantId) {
      throw new AppError('Forbidden: tenant out of scope', 403, 'FORBIDDEN');
    }
    const pickupData = normalizePickupPayload(body, { requireAddress: !existing });
    if (existing) {
      return InboundDelivery.updateById(existing.inboundDeliveryId, pickupData);
    }
    return InboundDelivery.create({
      inboundRequestId: id,
      tenantId: inbound.tenantId,
      ...pickupData,
    });
  }

  assertActorCanManageDelivery(actor, inbound);

  const requirePlate = !body.assignedDriverUserId && !existing?.vehiclePlate;
  const data = normalizeDispatchPayload(body, {
    requirePlate: requirePlate && body.vehiclePlate !== undefined,
  });

  if (data.assignedDriverUserId) {
    data.assignedDriverUserId = await assertTransporterAssignable(
      data.assignedDriverUserId,
      inbound.warehouseId
    );
    const transporter = await User.findById(data.assignedDriverUserId);
    const merged = applyTransporterProfileToDelivery(transporter, data, existing);
    Object.assign(data, merged);
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
    if (WAREHOUSE_DISPATCH_ROLES.includes(actor?.role) || actor?.role === 'SYSTEM_ADMIN') {
      void fireTransportAssignedNotify(inbound, updated, previousAssignedDriverUserId);
    }
    return updated;
  }

  const pickupFromBody = normalizePickupPayload(body);
  const hasPickup = Boolean(pickupFromBody.pickupAddress);
  const hasDispatch = Boolean(data.vehiclePlate || data.assignedDriverUserId);

  if (!hasDispatch && !hasPickup) {
    throw new AppError(
      'vehiclePlate, assignedDriverUserId, or pickupAddress is required',
      400,
      'VALIDATION_ERROR'
    );
  }

  const created = await InboundDelivery.create({
    inboundRequestId: id,
    tenantId: inbound.tenantId,
    ...pickupFromBody,
    ...data,
  });

  if (
    created?.assignedDriverUserId &&
    (WAREHOUSE_DISPATCH_ROLES.includes(actor?.role) || actor?.role === 'SYSTEM_ADMIN')
  ) {
    void fireTransportAssignedNotify(inbound, created, null);
  }

  return created;
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

  const updated = await InboundRequest.updateById(id, {
    status: 'ARRIVED',
    actualArrivalAt: new Date(),
    receivedBy: actor.userId,
  });

  try {
    await notifyInboundArrivalReported({
      inbound: updated,
      delivery,
      actor,
    });
  } catch {
    /* email optional */
  }

  return updated;
}
