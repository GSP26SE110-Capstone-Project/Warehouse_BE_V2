import Shipment from '../models/Shipment.js';
import AppError from '../utils/AppError.js';
import { SHIPMENT_STATUS } from '../constants/shipment.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { getOutboundRequest } from './outboundRequest.service.js';

const CREATE_FIELDS = [
  'tenantId',
  'outboundRequestId',
  'shipmentCode',
  'carrierName',
  'trackingNumber',
  'vehiclePlate',
  'driverName',
  'driverPhone',
  'driverIdNumber',
  'status',
  'shippedAt',
  'deliveredAt',
];

const UPDATE_FIELDS = [
  'carrierName',
  'trackingNumber',
  'vehiclePlate',
  'driverName',
  'driverPhone',
  'driverIdNumber',
  'status',
  'shippedAt',
  'deliveredAt',
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

function normalizePlateOptional(value) {
  if (value == null || value === '') return null;
  return String(value).trim().toUpperCase().replace(/\s+/g, '');
}

function parseDateTimeOptional(value, fieldName) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} is not a valid date-time`, 400, 'VALIDATION_ERROR');
  }
  return date;
}

function generateShipmentCode() {
  const ts = Date.now().toString(36).toUpperCase();
  return `SHP-${ts}`;
}

function normalizeVehicleFields(data) {
  if (data.vehiclePlate !== undefined) {
    data.vehiclePlate = normalizePlateOptional(data.vehiclePlate);
  }
  for (const key of ['driverName', 'driverPhone', 'driverIdNumber', 'carrierName', 'trackingNumber']) {
    if (data[key] != null) {
      const trimmed = String(data[key]).trim();
      data[key] = trimmed || null;
    }
  }
  if (data.shipmentCode != null) {
    data.shipmentCode = String(data.shipmentCode).trim() || null;
  }
}

async function normalizeCreatePayload(body) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.tenantId) throw new AppError('tenantId is required', 400, 'VALIDATION_ERROR');
  if (!data.outboundRequestId) {
    throw new AppError('outboundRequestId is required', 400, 'VALIDATION_ERROR');
  }

  data.tenantId = parseUuid(data.tenantId, 'tenantId');
  data.outboundRequestId = parseUuid(data.outboundRequestId, 'outboundRequestId');

  const outbound = await getOutboundRequest(data.outboundRequestId);
  if (outbound.tenantId !== data.tenantId) {
    throw new AppError('tenantId does not match outbound request', 400, 'VALIDATION_ERROR');
  }

  if (!data.shipmentCode) data.shipmentCode = generateShipmentCode();
  if (data.status == null) data.status = 'READY';
  assertEnum(data.status, SHIPMENT_STATUS, 'status');

  normalizeVehicleFields(data);

  if (data.shippedAt != null) data.shippedAt = parseDateTimeOptional(data.shippedAt, 'shippedAt');
  if (data.deliveredAt != null) {
    data.deliveredAt = parseDateTimeOptional(data.deliveredAt, 'deliveredAt');
  }

  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.status != null) assertEnum(data.status, SHIPMENT_STATUS, 'status');
  normalizeVehicleFields(data);

  if (data.shippedAt !== undefined) {
    data.shippedAt = parseDateTimeOptional(data.shippedAt, 'shippedAt');
  }
  if (data.deliveredAt !== undefined) {
    data.deliveredAt = parseDateTimeOptional(data.deliveredAt, 'deliveredAt');
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

export async function getShipment(shipmentId) {
  const id = parseUuid(shipmentId, 'shipmentId');
  const row = await Shipment.findById(id);
  if (!row) throw new AppError('Shipment not found', 404, 'NOT_FOUND');
  return row;
}

export async function listShipments({
  tenantId,
  outboundRequestId,
  status,
  page = 1,
  limit = 20,
  offset = 0,
}) {
  const filters = {};
  if (tenantId) filters.tenantId = parseUuid(tenantId, 'tenantId');
  if (outboundRequestId) {
    filters.outboundRequestId = parseUuid(outboundRequestId, 'outboundRequestId');
  }
  if (status) {
    assertEnum(status, SHIPMENT_STATUS, 'status');
    filters.status = status;
  }

  const [items, total] = await Promise.all([
    Shipment.findAll(filters, { orderBy: 'created_at DESC', limit, offset }),
    Shipment.count(filters),
  ]);

  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
  };
}

export async function createShipment(body) {
  const data = await normalizeCreatePayload(body);
  return Shipment.create(data);
}

export async function updateShipment(shipmentId, body) {
  const id = parseUuid(shipmentId, 'shipmentId');
  await getShipment(id);
  const data = normalizeUpdatePayload(body);
  return Shipment.updateById(id, data);
}

export async function deleteShipment(shipmentId) {
  const id = parseUuid(shipmentId, 'shipmentId');
  await getShipment(id);
  const deleted = await Shipment.deleteById(id);
  if (!deleted) throw new AppError('Shipment not found', 404, 'NOT_FOUND');
  return deleted;
}
