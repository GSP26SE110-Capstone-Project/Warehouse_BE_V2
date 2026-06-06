import pool from '../config/db.js';
import OutboundDelivery from '../models/OutboundDelivery.js';
import OutboundRequest from '../models/OutboundRequest.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { TENANT_ROLES, WH_TRANSPORT_ROLES } from '../constants/auth.js';
import { DELIVERY_MODE } from '../constants/delivery.js';
import { OUTBOUND_DELIVERY_STATUS } from '../constants/outboundDelivery.js';
import { assertEnum } from '../utils/validate.js';
import { getOutboundRequest } from './outboundRequest.service.js';
import { assertTransporterAvailable } from './transporterAvailability.service.js';
import { applyTransporterProfileToDelivery } from '../utils/transporterProfile.js';
import {
  notifyOutboundDeliveryAssigned,
  notifyOutboundPickupReported,
  notifyOutboundDelivered,
} from './outboundNotify.service.js';

const WAREHOUSE_DISPATCH_ROLES = Object.freeze(['SYSTEM_ADMIN', 'WH_ADMIN', 'WH_STAFF']);

const DISPATCH_FIELDS = [
  'vehiclePlate',
  'driverName',
  'driverPhone',
  'driverIdNumber',
  'carrierName',
  'notes',
];

const SHIP_TO_FIELDS = [
  'shipToAddress',
  'shipToContactName',
  'shipToContactPhone',
  'shipToNotes',
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

function normalizePlateOptional(value) {
  if (value == null || value === '') return null;
  return normalizePlate(value);
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
    throw new AppError(
      'assignedDriverUserId must be a WH_TRANSPORTER user',
      400,
      'VALIDATION_ERROR'
    );
  }
  if (user.status !== 'ACTIVE') {
    throw new AppError('Transporter account is not active', 400, 'VALIDATION_ERROR');
  }
  if (user.warehouseId !== warehouseId) {
    throw new AppError('Transporter does not belong to this warehouse', 400, 'VALIDATION_ERROR');
  }
  return id;
}

function assertActorCanManageDelivery(actor, outbound) {
  if (!actor) return;

  if (WH_TRANSPORT_ROLES.includes(actor.role)) {
    throw new AppError('Use transporter delivery update for this role', 403, 'FORBIDDEN');
  }

  if (WAREHOUSE_DISPATCH_ROLES.includes(actor.role)) {
    if (actor.role !== 'SYSTEM_ADMIN' && actor.warehouseId !== outbound.warehouseId) {
      throw new AppError('Forbidden: warehouse out of scope', 403, 'FORBIDDEN');
    }
    return;
  }

  if (TENANT_ROLES.includes(actor.role)) {
    if (actor.tenantId !== outbound.tenantId) {
      throw new AppError('Forbidden: tenant out of scope', 403, 'FORBIDDEN');
    }
    if (!['PENDING', 'DRAFT'].includes(outbound.status)) {
      throw new AppError(
        'Tenant can only update delivery info before warehouse processing',
        400,
        'INVALID_OUTBOUND_STATUS'
      );
    }
    return;
  }

  throw new AppError('Forbidden', 403, 'FORBIDDEN');
}

function assertTransporterCanAccessDelivery(actor, outbound, delivery) {
  if (!actor || !WH_TRANSPORT_ROLES.includes(actor.role)) {
    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }
  if (actor.warehouseId !== outbound.warehouseId) {
    throw new AppError('Forbidden: warehouse out of scope', 403, 'FORBIDDEN');
  }
  if (outbound.deliveryMode !== 'WAREHOUSE_TRANSPORT') {
    throw new AppError('This outbound is not warehouse transport', 400, 'VALIDATION_ERROR');
  }
  if (outbound.status !== 'SHIPPED') {
    throw new AppError(
      'Outbound delivery trip is only active after SHIPPED',
      400,
      'INVALID_OUTBOUND_STATUS'
    );
  }
  if (!delivery?.assignedDriverUserId || delivery.assignedDriverUserId !== actor.userId) {
    throw new AppError('Trip is not assigned to you', 403, 'FORBIDDEN');
  }
}

function normalizeShipToPayload(body, { requireAddress = false } = {}) {
  const data = pickFields(body, SHIP_TO_FIELDS);

  if (data.shipToAddress !== undefined) {
    const addr = trimOptionalString(data.shipToAddress);
    if (requireAddress && !addr) {
      throw new AppError('shipToAddress is required', 400, 'VALIDATION_ERROR');
    }
    data.shipToAddress = addr;
  } else if (requireAddress) {
    throw new AppError('shipToAddress is required', 400, 'VALIDATION_ERROR');
  }

  for (const key of ['shipToContactName', 'shipToContactPhone', 'shipToNotes']) {
    if (data[key] !== undefined) {
      data[key] = trimOptionalString(data[key]);
    }
  }

  if (requireAddress && !data.shipToContactName) {
    throw new AppError('shipToContactName is required', 400, 'VALIDATION_ERROR');
  }
  if (requireAddress && !data.shipToContactPhone) {
    throw new AppError('shipToContactPhone is required', 400, 'VALIDATION_ERROR');
  }

  return data;
}

function normalizeDispatchPayload(body, { requirePlate = false } = {}) {
  const data = pickFields(body, DISPATCH_FIELDS);

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
  }

  for (const key of ['driverName', 'driverPhone', 'driverIdNumber', 'carrierName', 'notes']) {
    if (data[key] !== undefined) {
      data[key] = trimOptionalString(data[key]);
    }
  }

  return data;
}

function normalizeTransporterPayload(body) {
  const data = pickFields(body, DISPATCH_FIELDS);

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

  return data;
}

export async function getOutboundDeliveryByRequestId(outboundRequestId) {
  const id = parseUuid(outboundRequestId, 'outboundRequestId');
  const rows = await OutboundDelivery.findAll({ outboundRequestId: id });
  return rows[0] ?? null;
}

export async function assertOutboundDeliveryReadyToShip(outbound) {
  const delivery = await getOutboundDeliveryByRequestId(outbound.outboundRequestId);

  if (outbound.deliveryMode === 'WAREHOUSE_TRANSPORT') {
    const addr = delivery?.shipToAddress?.trim();
    if (!addr) {
      throw new AppError(
        'shipToAddress is required for warehouse transport before shipping',
        400,
        'DELIVERY_INFO_REQUIRED'
      );
    }
    return delivery;
  }

  if (outbound.deliveryMode === 'TENANT_SELF') {
    const plate = delivery?.vehiclePlate?.trim();
    if (!plate) {
      throw new AppError(
        'vehiclePlate is required for tenant self pickup before shipping',
        400,
        'DELIVERY_INFO_REQUIRED'
      );
    }
    return delivery;
  }

  return delivery;
}

/** Tạo/cập nhật delivery sau khi SHIPPED (trong transaction caller). */
export async function ensureOutboundDeliveryOnShip(outbound, client) {
  const existing = await OutboundDelivery.findAll(
    { outboundRequestId: outbound.outboundRequestId },
    {},
    client
  );
  const row = existing[0];

  if (outbound.deliveryMode === 'TENANT_SELF') {
    if (row) {
      await OutboundDelivery.updateById(
        row.outboundDeliveryId,
        {
          deliveryStatus: 'DELIVERED',
          actualDeliveredAt: new Date(),
        },
        client
      );
      return;
    }
    throw new AppError(
      'Save tenant vehicle info on delivery before shipping',
      400,
      'DELIVERY_INFO_REQUIRED'
    );
  }

  if (outbound.deliveryMode === 'WAREHOUSE_TRANSPORT') {
    if (row) {
      await OutboundDelivery.updateById(
        row.outboundDeliveryId,
        { deliveryStatus: row.deliveryStatus === 'DELIVERED' ? 'DELIVERED' : 'PENDING' },
        client
      );
      return;
    }
    await OutboundDelivery.create(
      {
        outboundRequestId: outbound.outboundRequestId,
        tenantId: outbound.tenantId,
        deliveryStatus: 'PENDING',
      },
      client
    );
  }
}

export async function upsertOutboundDelivery(outboundRequestId, body, actor = null) {
  const id = parseUuid(outboundRequestId, 'outboundRequestId');
  const outbound = await getOutboundRequest(id);

  const existing = await getOutboundDeliveryByRequestId(id);
  const previousAssignedDriverUserId = existing?.assignedDriverUserId ?? null;

  if (actor && WH_TRANSPORT_ROLES.includes(actor.role)) {
    assertTransporterCanAccessDelivery(actor, outbound, existing);
    if (!existing) {
      throw new AppError('Delivery record not found for this trip', 404, 'NOT_FOUND');
    }
    const data = normalizeTransporterPayload(body);
    const merged = applyTransporterProfileToDelivery(actor, data, existing);
    return OutboundDelivery.updateById(existing.outboundDeliveryId, merged);
  }

  if (
    actor &&
    TENANT_ROLES.includes(actor.role) &&
    outbound.deliveryMode === 'WAREHOUSE_TRANSPORT'
  ) {
    if (actor.tenantId !== outbound.tenantId) {
      throw new AppError('Forbidden: tenant out of scope', 403, 'FORBIDDEN');
    }
    const shipToData = normalizeShipToPayload(body, { requireAddress: !existing });
    if (existing) {
      return OutboundDelivery.updateById(existing.outboundDeliveryId, shipToData);
    }
    return OutboundDelivery.create({
      outboundRequestId: id,
      tenantId: outbound.tenantId,
      deliveryStatus: 'PENDING',
      ...shipToData,
    });
  }

  if (actor && TENANT_ROLES.includes(actor.role) && outbound.deliveryMode === 'TENANT_SELF') {
    assertActorCanManageDelivery(actor, outbound);
    const data = normalizeDispatchPayload(body, {
      requirePlate: !existing && body.vehiclePlate !== undefined,
    });
    if (existing) {
      return OutboundDelivery.updateById(existing.outboundDeliveryId, data);
    }
    return OutboundDelivery.create({
      outboundRequestId: id,
      tenantId: outbound.tenantId,
      deliveryStatus: 'PENDING',
      ...data,
    });
  }

  assertActorCanManageDelivery(actor, outbound);

  if (outbound.deliveryMode !== 'WAREHOUSE_TRANSPORT') {
    throw new AppError(
      'Only WAREHOUSE_TRANSPORT outbound supports driver assignment',
      400,
      'VALIDATION_ERROR'
    );
  }

  if (outbound.status !== 'SHIPPED') {
    throw new AppError(
      'Assign transporter after outbound is SHIPPED (inventory deducted)',
      400,
      'INVALID_OUTBOUND_STATUS'
    );
  }

  if (!existing) {
    throw new AppError('Delivery record not found — ship outbound first', 404, 'NOT_FOUND');
  }

  if (['IN_TRANSIT', 'DELIVERED'].includes(existing.deliveryStatus)) {
    throw new AppError(
      'Cannot change assignment after pickup has started',
      400,
      'INVALID_OUTBOUND_STATUS'
    );
  }

  const data = normalizeDispatchPayload(body);
  let nextStatus = existing.deliveryStatus ?? 'PENDING';

  if (data.assignedDriverUserId) {
    data.assignedDriverUserId = await assertTransporterAssignable(
      data.assignedDriverUserId,
      outbound.warehouseId
    );
    await assertTransporterAvailable(data.assignedDriverUserId, outbound.warehouseId, {
      excludeOutboundRequestId: id,
    });
    nextStatus = 'ASSIGNED';
  } else if (body.assignedDriverUserId === null) {
    data.assignedDriverUserId = null;
    nextStatus = 'PENDING';
  }

  const updated = await OutboundDelivery.updateById(existing.outboundDeliveryId, {
    ...data,
    deliveryStatus: nextStatus,
  });

  if (
    updated?.assignedDriverUserId &&
    updated.assignedDriverUserId !== previousAssignedDriverUserId
  ) {
    void notifyOutboundDeliveryAssigned({ outbound, delivery: updated }).catch(() => {});
  }

  return updated;
}

export async function reportOutboundPickup(outboundRequestId, actor) {
  if (!actor || !WH_TRANSPORT_ROLES.includes(actor.role)) {
    throw new AppError('WH_TRANSPORTER only', 403, 'FORBIDDEN');
  }

  const id = parseUuid(outboundRequestId, 'outboundRequestId');
  const outbound = await getOutboundRequest(id);
  const delivery = await getOutboundDeliveryByRequestId(id);

  assertTransporterCanAccessDelivery(actor, outbound, delivery);

  if (delivery.deliveryStatus !== 'ASSIGNED') {
    throw new AppError(
      `Cannot report pickup when delivery status is ${delivery.deliveryStatus}`,
      400,
      'INVALID_OUTBOUND_STATUS'
    );
  }

  if (!delivery?.shipToAddress?.trim()) {
    throw new AppError('shipToAddress is required before reporting pickup', 400, 'VALIDATION_ERROR');
  }

  if (!delivery?.vehiclePlate?.trim()) {
    throw new AppError(
      'Save vehicle plate before reporting pickup',
      400,
      'DELIVERY_INFO_REQUIRED'
    );
  }

  const pickupAt = new Date();
  const updatedDelivery = await OutboundDelivery.updateById(delivery.outboundDeliveryId, {
    deliveryStatus: 'IN_TRANSIT',
    actualPickupAt: pickupAt,
  });

  try {
    await notifyOutboundPickupReported({
      outbound,
      delivery: updatedDelivery,
      actor,
    });
  } catch {
    /* optional email */
  }

  return { outbound, delivery: updatedDelivery };
}

export async function reportOutboundDelivery(outboundRequestId, actor) {
  if (!actor || !WH_TRANSPORT_ROLES.includes(actor.role)) {
    throw new AppError('WH_TRANSPORTER only', 403, 'FORBIDDEN');
  }

  const id = parseUuid(outboundRequestId, 'outboundRequestId');
  const outbound = await getOutboundRequest(id);
  const delivery = await getOutboundDeliveryByRequestId(id);

  assertTransporterCanAccessDelivery(actor, outbound, delivery);

  if (delivery.deliveryStatus !== 'IN_TRANSIT') {
    throw new AppError(
      `Cannot report delivery when status is ${delivery.deliveryStatus}`,
      400,
      'INVALID_OUTBOUND_STATUS'
    );
  }

  const deliveredAt = new Date();
  const updatedDelivery = await OutboundDelivery.updateById(delivery.outboundDeliveryId, {
    deliveryStatus: 'DELIVERED',
    actualDeliveredAt: deliveredAt,
  });

  let updatedOutbound = outbound;
  if (outbound.status === 'SHIPPED') {
    updatedOutbound = await OutboundRequest.updateById(id, { status: 'COMPLETED' });
  }

  try {
    await notifyOutboundDelivered({
      outbound: updatedOutbound,
      delivery: updatedDelivery,
      actor,
    });
  } catch {
    /* optional email */
  }

  return { outbound: updatedOutbound, delivery: updatedDelivery };
}

export function assertOutboundDeliveryMode(value) {
  assertEnum(value, DELIVERY_MODE, 'deliveryMode');
}

export { OUTBOUND_DELIVERY_STATUS };
