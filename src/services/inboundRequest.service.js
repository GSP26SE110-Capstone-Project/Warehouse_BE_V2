import pool from '../config/db.js';
import InboundRequest, { inboundRequestSchema } from '../models/InboundRequest.js';
import InboundRequestItem from '../models/InboundRequestItem.js';
import { inboundDeliverySchema } from '../models/InboundDelivery.js';
import { fromDbRecord } from '../models/utils/fieldMapper.js';
import AppError from '../utils/AppError.js';
import { INBOUND_STATUS } from '../constants/inbound.js';
import { DELIVERY_MODE } from '../constants/delivery.js';
import { assertInboundHasDeliveryForGate } from './inboundDelivery.service.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { assertInboundStatusTransition } from '../utils/inboundStatus.js';
import { assertNoInboundReceivingActivity } from './inboundApprovalReadiness.service.js';
import { assertContractOperational, getContract } from './contract.service.js';
import {
  assertOperationalInvoicePaid,
  createOperationalInvoiceForInbound,
} from './operationalInvoice.service.js';
import { assertContractInboundWithinCommittedPieces } from './contractInboundCommitment.service.js';
import { getTenantCompany } from './tenantCompany.service.js';
import { getWarehouseById } from './warehouse.service.js';
import { getSku } from './sku.service.js';

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
  const contract = await assertContractOperational(contractId);

  if (contract.tenantId !== tenantId) {
    throw new AppError('contractId does not belong to this tenant', 400, 'VALIDATION_ERROR');
  }
  if (contract.warehouseId !== warehouseId) {
    throw new AppError('contractId does not belong to this warehouse', 400, 'VALIDATION_ERROR');
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

function mapInboundRow(row) {
  const inbound = fromDbRecord(inboundRequestSchema, row);
  if (row.delivery_inbound_delivery_id) {
    inbound.delivery = fromDbRecord(inboundDeliverySchema, {
      inbound_delivery_id: row.delivery_inbound_delivery_id,
      inbound_request_id: row.delivery_inbound_request_id,
      tenant_id: row.delivery_tenant_id,
      vehicle_plate: row.delivery_vehicle_plate,
      driver_name: row.delivery_driver_name,
      driver_phone: row.delivery_driver_phone,
      driver_id_number: row.delivery_driver_id_number,
      carrier_name: row.delivery_carrier_name,
      scheduled_at: row.delivery_scheduled_at,
      notes: row.delivery_notes,
      pickup_address: row.delivery_pickup_address,
      pickup_contact_name: row.delivery_pickup_contact_name,
      pickup_contact_phone: row.delivery_pickup_contact_phone,
      pickup_notes: row.delivery_pickup_notes,
      actual_pickup_at: row.delivery_actual_pickup_at,
      assigned_driver_user_id: row.delivery_assigned_driver_user_id,
      created_at: row.delivery_created_at,
      updated_at: row.delivery_updated_at,
    });
  }
  return inbound;
}

async function listInboundRequestsWithAssignedDriver({
  assignedDriverUserId,
  warehouseId,
  contractId,
  status,
  deliveryMode,
  includeDelivery,
  page,
  limit,
  offset,
}) {
  assertEnum(status, INBOUND_STATUS, 'status');

  const driverId = parseUuid(assignedDriverUserId, 'assignedDriverUserId');
  const conditions = ['id.assigned_driver_user_id = $1'];
  const values = [driverId];
  let n = 2;

  if (warehouseId) {
    const wId = parseUuid(warehouseId, 'warehouseId');
    await getWarehouseById(wId);
    conditions.push(`ir.warehouse_id = $${n++}`);
    values.push(wId);
  }
  if (contractId) {
    conditions.push(`ir.contract_id = $${n++}`);
    values.push(parseUuid(contractId, 'contractId'));
  }
  if (status) {
    conditions.push(`ir.status = $${n++}::inbound_status_enum`);
    values.push(status);
  }
  if (deliveryMode) {
    assertEnum(deliveryMode, DELIVERY_MODE, 'deliveryMode');
    conditions.push(`ir.delivery_mode = $${n++}::delivery_mode_enum`);
    values.push(deliveryMode);
  }

  const where = conditions.join(' AND ');
  const deliverySelect = includeDelivery
    ? `,
      id.inbound_delivery_id AS delivery_inbound_delivery_id,
      id.inbound_request_id AS delivery_inbound_request_id,
      id.tenant_id AS delivery_tenant_id,
      id.vehicle_plate AS delivery_vehicle_plate,
      id.driver_name AS delivery_driver_name,
      id.driver_phone AS delivery_driver_phone,
      id.driver_id_number AS delivery_driver_id_number,
      id.carrier_name AS delivery_carrier_name,
      id.scheduled_at AS delivery_scheduled_at,
      id.notes AS delivery_notes,
      id.pickup_address AS delivery_pickup_address,
      id.pickup_contact_name AS delivery_pickup_contact_name,
      id.pickup_contact_phone AS delivery_pickup_contact_phone,
      id.pickup_notes AS delivery_pickup_notes,
      id.actual_pickup_at AS delivery_actual_pickup_at,
      id.assigned_driver_user_id AS delivery_assigned_driver_user_id,
      id.created_at AS delivery_created_at,
      id.updated_at AS delivery_updated_at`
  : '';

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM inbound_requests ir
     INNER JOIN inbound_deliveries id ON id.inbound_request_id = ir.inbound_request_id
     WHERE ${where}`,
    values
  );
  const total = countResult.rows[0].count;

  const listResult = await pool.query(
    `SELECT ir.*${deliverySelect}
     FROM inbound_requests ir
     INNER JOIN inbound_deliveries id ON id.inbound_request_id = ir.inbound_request_id
     WHERE ${where}
     ORDER BY ir.created_at DESC
     LIMIT $${n} OFFSET $${n + 1}`,
    [...values, limit, offset]
  );

  return {
    items: listResult.rows.map(mapInboundRow),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}

export async function listInboundRequests({
  tenantId,
  warehouseId,
  contractId,
  status,
  deliveryMode,
  assignedDriverUserId,
  includeDelivery,
  page,
  limit,
  offset,
}) {
  assertEnum(status, INBOUND_STATUS, 'status');

  if (assignedDriverUserId) {
    return listInboundRequestsWithAssignedDriver({
      assignedDriverUserId,
      warehouseId,
      contractId,
      status,
      deliveryMode,
      includeDelivery: includeDelivery ?? true,
      page,
      limit,
      offset,
    });
  }

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
  if (deliveryMode) {
    assertEnum(deliveryMode, DELIVERY_MODE, 'deliveryMode');
    filters.deliveryMode = deliveryMode;
  }

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

function normalizeInboundItemsPayload(items) {
  if (items == null) return null;
  if (!Array.isArray(items)) {
    throw new AppError('items must be an array', 400, 'VALIDATION_ERROR');
  }
  if (items.length === 0) {
    throw new AppError('items must be a non-empty array when provided', 400, 'VALIDATION_ERROR');
  }

  const normalized = [];
  const skuIds = new Set();

  for (const [index, row] of items.entries()) {
    if (!row?.skuId) {
      throw new AppError(`items[${index}].skuId is required`, 400, 'VALIDATION_ERROR');
    }
    const skuId = parseUuid(row.skuId, `items[${index}].skuId`);
    if (skuIds.has(skuId)) {
      throw new AppError(
        'Duplicate SKU in items — use one line per skuId',
        400,
        'VALIDATION_ERROR'
      );
    }
    skuIds.add(skuId);

    const qty = Number(row.expectedQuantity);
    if (!Number.isInteger(qty) || qty < 1) {
      throw new AppError(
        `items[${index}].expectedQuantity must be a positive integer`,
        400,
        'VALIDATION_ERROR'
      );
    }

    normalized.push({ skuId, expectedQuantity: qty });
  }

  return normalized;
}

async function assertInboundItemsForTenant(tenantId, items) {
  for (const row of items) {
    const sku = await getSku(row.skuId);
    if (sku.tenantId !== tenantId) {
      throw new AppError('skuId does not belong to this inbound tenant', 400, 'VALIDATION_ERROR');
    }
  }
}

async function createInboundItemsInTransaction(client, inboundRequestId, items) {
  const created = [];
  for (const row of items) {
    const item = await InboundRequestItem.create(
      {
        inboundRequestId,
        skuId: row.skuId,
        expectedQuantity: row.expectedQuantity,
        receivedQuantity: 0,
        discrepancyQuantity: row.expectedQuantity,
      },
      client
    );
    created.push(item);
  }
  return created;
}

export async function createInboundRequest(body) {
  const { items: rawItems, ...headerBody } = body ?? {};
  const data = normalizeCreatePayload(headerBody);
  const items = normalizeInboundItemsPayload(rawItems);

  await getTenantCompany(data.tenantId);
  await getWarehouseById(data.warehouseId);
  const contract = await assertContractForInbound(
    data.tenantId,
    data.contractId,
    data.warehouseId
  );
  assertExpectedArrivalOnOrAfterContractStart(contract, data.expectedArrivalDate);

  if (!items) {
    return InboundRequest.create(data);
  }

  await assertInboundItemsForTenant(data.tenantId, items);
  const additionalPieces = items.reduce((sum, row) => sum + row.expectedQuantity, 0);
  await assertContractInboundWithinCommittedPieces(data.contractId, {
    additionalPieces,
    items,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inbound = await InboundRequest.create(data, client);
    await createInboundItemsInTransaction(client, inbound.inboundRequestId, items);
    await client.query('COMMIT');
    await createOperationalInvoiceForInbound(inbound.inboundRequestId);
    return inbound;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
    if (data.status === 'APPROVED') {
      await assertOperationalInvoicePaid('INBOUND_REQUEST', id);
      await assertContractInboundWithinCommittedPieces(existing.contractId);
    }
    if (existing.status === 'APPROVED' && data.status === 'PENDING') {
      await assertNoInboundReceivingActivity(id);
      data.approvedBy = null;
    }
    if (data.status === 'CANCELLED' && ['APPROVED', 'IN_TRANSIT', 'ARRIVED'].includes(existing.status)) {
      await assertNoInboundReceivingActivity(id);
    }
    if (data.status === 'IN_TRANSIT') {
      throw new AppError(
        'Warehouse transport pickup must be reported by the assigned transporter',
        403,
        'FORBIDDEN'
      );
    }
    if (data.status === 'ARRIVED') {
      await assertInboundHasDeliveryForGate(id);
      if (existing.deliveryMode === 'WAREHOUSE_TRANSPORT') {
        throw new AppError(
          'Warehouse transport arrivals must be reported by the assigned transporter',
          403,
          'FORBIDDEN'
        );
      }
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
