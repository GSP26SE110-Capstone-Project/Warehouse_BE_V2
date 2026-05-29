import InboundRequest from '../models/InboundRequest.js';
import AppError from '../utils/AppError.js';
import { INBOUND_STATUS } from '../constants/inbound.js';
import { DELIVERY_MODE } from '../constants/delivery.js';
import { assertInboundHasDeliveryForGate } from './inboundDelivery.service.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { assertInboundStatusTransition } from '../utils/inboundStatus.js';
import { assertNoInboundReceivingActivity } from './inboundApprovalReadiness.service.js';
import { getContract } from './contract.service.js';
import { getTenantCompany } from './tenantCompany.service.js';
import { getWarehouseById } from './warehouse.service.js';

const CREATE_FIELDS = [
  'tenantId',
  'contractId',
  'warehouseId',
  'inboundCode',
  'deliveryMode',
  'expectedArrivalDate',
  'actualArrivalAt',
  'status',
  'createdBy',
  'approvedBy',
  'receivedBy',
];

const UPDATE_FIELDS = [
  'deliveryMode',
  'expectedArrivalDate',
  'actualArrivalAt',
  'status',
  'approvedBy',
  'receivedBy',
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

function generateInboundCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000)
    .toString(36)
    .toUpperCase()
    .padStart(2, '0');
  return `INB-${ts}-${rand}`;
}

function parseDateTime(value, fieldName) {
  if (value == null || value === '') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} is not a valid date-time`, 400, 'VALIDATION_ERROR');
  }
  return date;
}

function parseOptionalUserId(value, fieldName) {
  if (value == null || value === '') return undefined;
  return parseUuid(value, fieldName);
}

async function assertContractForInbound(tenantId, contractId, warehouseId) {
  const contract = await getContract(contractId);

  if (contract.tenantId !== tenantId) {
    throw new AppError('contractId does not belong to this tenant', 400, 'VALIDATION_ERROR');
  }
  if (contract.warehouseId !== warehouseId) {
    throw new AppError('contractId does not belong to this warehouse', 400, 'VALIDATION_ERROR');
  }
  if (contract.status !== 'ACTIVE') {
    throw new AppError(
      'Contract must be ACTIVE to create an inbound request',
      400,
      'VALIDATION_ERROR'
    );
  }

  return contract;
}

function startOfDayUtc(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function assertExpectedArrivalOnOrAfterContractStart(contract, expectedArrivalDate) {
  if (expectedArrivalDate == null || !contract?.startDate) return;

  const arrivalDay = startOfDayUtc(expectedArrivalDate);
  const contractStartDay = startOfDayUtc(contract.startDate);

  if (arrivalDay < contractStartDay) {
    const startLabel =
      contract.startDate instanceof Date
        ? contract.startDate.toISOString().slice(0, 10)
        : String(contract.startDate).slice(0, 10);
    throw new AppError(
      `Ngày dự kiến đến kho không được trước ngày bắt đầu hợp đồng (${startLabel})`,
      400,
      'VALIDATION_ERROR'
    );
  }
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

  if (data.inboundCode != null) {
    data.inboundCode = String(data.inboundCode).trim();
    if (!data.inboundCode) {
      throw new AppError('inboundCode cannot be empty', 400, 'VALIDATION_ERROR');
    }
  } else {
    data.inboundCode = generateInboundCode();
  }

  if (data.expectedArrivalDate != null) {
    data.expectedArrivalDate = parseDateTime(data.expectedArrivalDate, 'expectedArrivalDate');
  }
  if (data.actualArrivalAt != null) {
    data.actualArrivalAt = parseDateTime(data.actualArrivalAt, 'actualArrivalAt');
  }

  if (data.status == null) data.status = 'PENDING';
  assertEnum(data.status, INBOUND_STATUS, 'status');

  if (data.deliveryMode == null) data.deliveryMode = 'TENANT_SELF';
  assertEnum(data.deliveryMode, DELIVERY_MODE, 'deliveryMode');

  if (data.createdBy != null) data.createdBy = parseOptionalUserId(data.createdBy, 'createdBy');
  if (data.approvedBy != null) data.approvedBy = parseOptionalUserId(data.approvedBy, 'approvedBy');
  if (data.receivedBy != null) data.receivedBy = parseOptionalUserId(data.receivedBy, 'receivedBy');

  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.expectedArrivalDate !== undefined) {
    if (data.expectedArrivalDate === null || data.expectedArrivalDate === '') {
      data.expectedArrivalDate = null;
    } else {
      data.expectedArrivalDate = parseDateTime(
        data.expectedArrivalDate,
        'expectedArrivalDate'
      );
    }
  }
  if (data.actualArrivalAt !== undefined) {
    if (data.actualArrivalAt === null || data.actualArrivalAt === '') {
      data.actualArrivalAt = null;
    } else {
      data.actualArrivalAt = parseDateTime(data.actualArrivalAt, 'actualArrivalAt');
    }
  }

  assertEnum(data.status, INBOUND_STATUS, 'status');

  if (data.approvedBy !== undefined) {
    data.approvedBy =
      data.approvedBy === null || data.approvedBy === ''
        ? null
        : parseOptionalUserId(data.approvedBy, 'approvedBy');
  }
  if (data.receivedBy !== undefined) {
    data.receivedBy =
      data.receivedBy === null || data.receivedBy === ''
        ? null
        : parseOptionalUserId(data.receivedBy, 'receivedBy');
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

export async function getInboundRequest(inboundRequestId) {
  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  const inbound = await InboundRequest.findById(id);
  if (!inbound) {
    throw new AppError('Inbound request not found', 404, 'NOT_FOUND');
  }
  return inbound;
}

export async function listInboundRequests({
  tenantId,
  warehouseId,
  contractId,
  status,
  page,
  limit,
  offset,
}) {
  assertEnum(status, INBOUND_STATUS, 'status');

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
    InboundRequest.findAll(filters, {
      orderBy: 'created_at DESC',
      limit,
      offset,
    }),
    InboundRequest.count(filters),
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

export async function createInboundRequest(body) {
  const data = normalizeCreatePayload(body);

  await getTenantCompany(data.tenantId);
  await getWarehouseById(data.warehouseId);
  const contract = await assertContractForInbound(
    data.tenantId,
    data.contractId,
    data.warehouseId
  );
  assertExpectedArrivalOnOrAfterContractStart(contract, data.expectedArrivalDate);

  return InboundRequest.create(data);
}

export async function updateInboundRequest(inboundRequestId, body) {
  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  const existing = await getInboundRequest(id);

  const data = normalizeUpdatePayload(body);

  if (data.expectedArrivalDate !== undefined) {
    const contract = await getContract(existing.contractId);
    assertExpectedArrivalOnOrAfterContractStart(contract, data.expectedArrivalDate);
  }

  if (data.deliveryMode !== undefined) {
    assertEnum(data.deliveryMode, DELIVERY_MODE, 'deliveryMode');
  }

  if (data.status !== undefined && data.status !== existing.status) {
    assertInboundStatusTransition(existing.status, data.status);
    if (existing.status === 'APPROVED' && data.status === 'PENDING') {
      await assertNoInboundReceivingActivity(id);
      data.approvedBy = null;
    }
    if (data.status === 'CANCELLED' && ['APPROVED', 'ARRIVED'].includes(existing.status)) {
      await assertNoInboundReceivingActivity(id);
    }
    if (data.status === 'ARRIVED') {
      await assertInboundHasDeliveryForGate(id);
    }
  }

  return InboundRequest.updateById(id, data);
}

export async function deleteInboundRequest(inboundRequestId) {
  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  await getInboundRequest(id);

  const deleted = await InboundRequest.deleteById(id);
  if (!deleted) {
    throw new AppError('Inbound request not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
