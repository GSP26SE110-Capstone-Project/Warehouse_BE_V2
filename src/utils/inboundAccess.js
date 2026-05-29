import AppError from './AppError.js';
import { TENANT_ROLES, WH_TRANSPORT_ROLES, WAREHOUSE_ROLES } from '../constants/auth.js';
import { getInboundDeliveryByRequestId } from '../services/inboundDelivery.service.js';
import { getInboundRequest } from '../services/inboundRequest.service.js';

const WAREHOUSE_OPS_ROLES = Object.freeze(['SYSTEM_ADMIN', 'WH_ADMIN', 'WH_STAFF']);

export async function assertInboundReadable(inboundRequestId, actor) {
  const inbound = await getInboundRequest(inboundRequestId);
  if (!actor) return inbound;

  if (actor.role === 'SYSTEM_ADMIN') return inbound;

  if (WH_TRANSPORT_ROLES.includes(actor.role)) {
    const delivery = await getInboundDeliveryByRequestId(inboundRequestId);
    if (actor.warehouseId !== inbound.warehouseId) {
      throw new AppError('Forbidden: warehouse out of scope', 403, 'FORBIDDEN');
    }
    if (
      !delivery?.assignedDriverUserId ||
      delivery.assignedDriverUserId !== actor.userId
    ) {
      throw new AppError('Trip is not assigned to you', 403, 'FORBIDDEN');
    }
    return inbound;
  }

  if (WAREHOUSE_OPS_ROLES.includes(actor.role)) {
    if (actor.warehouseId && actor.warehouseId !== inbound.warehouseId) {
      throw new AppError('Forbidden: warehouse out of scope', 403, 'FORBIDDEN');
    }
    return inbound;
  }

  if (TENANT_ROLES.includes(actor.role)) {
    if (actor.tenantId !== inbound.tenantId) {
      throw new AppError('Forbidden: tenant out of scope', 403, 'FORBIDDEN');
    }
    return inbound;
  }

  throw new AppError('Forbidden', 403, 'FORBIDDEN');
}

export function applyInboundListScope(actor, query) {
  const scoped = { ...query };
  if (!actor) return scoped;

  if (WH_TRANSPORT_ROLES.includes(actor.role)) {
    scoped.assignedDriverUserId = actor.userId;
    scoped.warehouseId = actor.warehouseId ?? scoped.warehouseId;
    scoped.deliveryMode = scoped.deliveryMode ?? 'WAREHOUSE_TRANSPORT';
    scoped.includeDelivery = scoped.includeDelivery ?? true;
    return scoped;
  }

  if (actor.role === 'WH_ADMIN' || actor.role === 'WH_STAFF') {
    scoped.warehouseId = actor.warehouseId ?? scoped.warehouseId;
    return scoped;
  }

  if (TENANT_ROLES.includes(actor.role)) {
    scoped.tenantId = actor.tenantId ?? scoped.tenantId;
    return scoped;
  }

  return scoped;
}
