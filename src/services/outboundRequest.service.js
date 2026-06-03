import OutboundRequest from '../models/OutboundRequest.js';
import AppError from '../utils/AppError.js';
import { OUTBOUND_STATUS } from '../constants/outbound.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { assertContractAllowsOutbound } from './contract.service.js';
import { assertOutboundOperationalGate } from '../utils/contractOperationalGate.js';
import { getTenantCompany } from './tenantCompany.service.js';
import { getWarehouseById } from './warehouse.service.js';
import {
  assertOutboundHasAtLeastOneItem,
  assertOutboundInventorySufficient,
  createOutboundRequestItem,
  getOutboundRequestWithItems,
} from './outboundRequestItem.service.js';
import {
  applyOutboundStatusChange,
  releaseOutboundReservations,
} from './outboundWorkflow.service.js';

const CREATE_FIELDS = [
  'tenantId',
  'contractId',
  'warehouseId',
  'outboundCode',
  'requestedShipDate',
  'actualShippedAt',
  'status',
];

const UPDATE_FIELDS = ['requestedShipDate', 'actualShippedAt', 'status'];

function pickFields(source, fields) {
  const result = {};
  for (const field of fields) {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
  }
  return result;
}

function generateOutboundCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000)
    .toString(36)
    .toUpperCase()
    .padStart(2, '0');
  return `OUT-${ts}-${rand}`;
}

function parseDateTime(value, fieldName) {
  if (value == null || value === '') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} is not a valid date-time`, 400, 'VALIDATION_ERROR');
  }
  return date;
}

function actorUserId(actor) {
  if (!actor?.userId) {
    throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
  }
  return actor.userId;
}

async function assertContractForOutbound(tenantId, contractId, warehouseId) {
  const contract = await assertContractAllowsOutbound(contractId);

  if (contract.tenantId !== tenantId) {
    throw new AppError('contractId does not belong to this tenant', 400, 'VALIDATION_ERROR');
  }
  if (contract.warehouseId !== warehouseId) {
    throw new AppError('contractId does not belong to this warehouse', 400, 'VALIDATION_ERROR');
  }

  await assertOutboundOperationalGate(contractId, tenantId, warehouseId);

  return contract;
}

function normalizeCreatePayload(body) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.tenantId) {
    throw new AppError('tenantId is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.contractId) {
    throw new AppError('contractId is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.warehouseId) {
    throw new AppError('warehouseId is required', 400, 'VALIDATION_ERROR');
  }

  data.tenantId = parseUuid(data.tenantId, 'tenantId');
  data.contractId = parseUuid(data.contractId, 'contractId');
  data.warehouseId = parseUuid(data.warehouseId, 'warehouseId');

  if (data.outboundCode != null) {
    data.outboundCode = String(data.outboundCode).trim();
    if (!data.outboundCode) {
      throw new AppError('outboundCode cannot be empty', 400, 'VALIDATION_ERROR');
    }
  } else {
    data.outboundCode = generateOutboundCode();
  }

  if (data.requestedShipDate != null) {
    data.requestedShipDate = parseDateTime(data.requestedShipDate, 'requestedShipDate');
  }
  if (data.actualShippedAt != null) {
    data.actualShippedAt = parseDateTime(data.actualShippedAt, 'actualShippedAt');
  }

  if (data.status == null) data.status = 'PENDING';
  assertEnum(data.status, OUTBOUND_STATUS, 'status');

  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.requestedShipDate !== undefined) {
    if (data.requestedShipDate === null || data.requestedShipDate === '') {
      data.requestedShipDate = null;
    } else {
      data.requestedShipDate = parseDateTime(
        data.requestedShipDate,
        'requestedShipDate'
      );
    }
  }
  if (data.actualShippedAt !== undefined) {
    if (data.actualShippedAt === null || data.actualShippedAt === '') {
      data.actualShippedAt = null;
    } else {
      data.actualShippedAt = parseDateTime(data.actualShippedAt, 'actualShippedAt');
    }
  }

  if (data.status !== undefined) {
    assertEnum(data.status, OUTBOUND_STATUS, 'status');
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

export async function getOutboundRequest(outboundRequestId) {
  const id = parseUuid(outboundRequestId, 'outboundRequestId');
  const outbound = await OutboundRequest.findById(id);
  if (!outbound) {
    throw new AppError('Outbound request not found', 404, 'NOT_FOUND');
  }
  return outbound;
}

export async function listOutboundRequests({
  tenantId,
  warehouseId,
  contractId,
  status,
  page,
  limit,
  offset,
}) {
  assertEnum(status, OUTBOUND_STATUS, 'status');

  const filters = {};
  if (tenantId) {
    const tId = parseUuid(tenantId, 'tenantId');
    await getTenantCompany(tId);
    filters.tenantId = tId;
  }
  if (warehouseId) {
    const wId = parseUuid(warehouseId, 'warehouseId');
    await getWarehouseById(wId);
    filters.warehouseId = wId;
  }
  if (contractId) {
    filters.contractId = parseUuid(contractId, 'contractId');
  }
  if (status) filters.status = status;

  const [items, total] = await Promise.all([
    OutboundRequest.findAll(filters, {
      orderBy: 'created_at DESC',
      limit,
      offset,
    }),
    OutboundRequest.count(filters),
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

export async function createOutboundRequest(body, actor = null) {
  const rawItems = body?.items;
  const headerBody = { ...body };
  delete headerBody.items;
  delete headerBody.createdBy;
  delete headerBody.approvedBy;

  const data = normalizeCreatePayload(headerBody);

  if (actor?.userId) {
    data.createdBy = actorUserId(actor);
  }

  await getTenantCompany(data.tenantId);
  await getWarehouseById(data.warehouseId);
  await assertContractForOutbound(data.tenantId, data.contractId, data.warehouseId);

  const outbound = await OutboundRequest.create(data);

  if (Array.isArray(rawItems) && rawItems.length > 0) {
    try {
      for (const entry of rawItems) {
        await createOutboundRequestItem(
          { skuId: entry.skuId, requestedQuantity: entry.requestedQuantity },
          outbound.outboundRequestId
        );
      }
    } catch (err) {
      await OutboundRequest.deleteById(outbound.outboundRequestId);
      throw err;
    }
  }

  if (data.status === 'PENDING') {
    await assertOutboundHasAtLeastOneItem(outbound.outboundRequestId);
  }

  if (Array.isArray(rawItems) && rawItems.length > 0) {
    return getOutboundRequestWithItems(outbound.outboundRequestId);
  }

  return outbound;
}

export async function updateOutboundRequest(outboundRequestId, body, actor = null) {
  const id = parseUuid(outboundRequestId, 'outboundRequestId');
  const existing = await getOutboundRequest(id);

  const sanitized = { ...body };
  delete sanitized.approvedBy;
  delete sanitized.createdBy;

  const data = normalizeUpdatePayload(sanitized);

  if (data.status !== undefined && data.status !== existing.status) {
    if (data.status === 'PENDING') {
      await assertOutboundHasAtLeastOneItem(id);
    }

    const workflowPatch = await applyOutboundStatusChange(
      existing,
      data.status,
      actor,
      data
    );

    if (workflowPatch.__fullyHandled) {
      return getOutboundRequest(id);
    }

    const { status: _s, __fullyHandled: _h, ...rest } = workflowPatch;
    return OutboundRequest.updateById(id, { ...rest, status: workflowPatch.status });
  }

  return OutboundRequest.updateById(id, data);
}

export async function deleteOutboundRequest(outboundRequestId) {
  const id = parseUuid(outboundRequestId, 'outboundRequestId');
  const existing = await getOutboundRequest(id);

  if (['RESERVED', 'PICKING', 'PACKING'].includes(existing.status)) {
    await releaseOutboundReservations(id);
  }

  const deleted = await OutboundRequest.deleteById(id);
  if (!deleted) {
    throw new AppError('Outbound request not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
