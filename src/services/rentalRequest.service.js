import RentalRequest from '../models/RentalRequest.js';
import AppError from '../utils/AppError.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { ZONE_TYPE, RACK_TYPE } from '../constants/warehouseStructure.js';
import {
  BILLING_CYCLE,
  CONTRACT_TYPE,
  PRICING_MODEL,
  RENTAL_REQUEST_STATUS,
} from '../constants/tenantOnboarding.js';
import { getWarehouseById } from './warehouse.service.js';

const CREATE_FIELDS = [
  'requestCode',
  'companyName',
  'companyCode',
  'taxCode',
  'address',
  'contactName',
  'contactEmail',
  'contactPhone',
  'contractType',
  'pricingModel',
  'billingCycle',
  'estimatedSkuCount',
  'estimatedBoxCount',
  'estimatedVolume',
  'averageStorageDays',
  'estimatedInboundPerWeek',
  'estimatedOutboundPerWeek',
  'requiresFastPicking',
  'requiresPremiumStorage',
  'notes',
  'suggestedZoneType',
  'suggestedRackType',
  'expectedStartDate',
  'expectedEndDate',
  'status',
  'createdBy',
];

const UPDATE_FIELDS = [
  'companyName',
  'companyCode',
  'taxCode',
  'address',
  'contactName',
  'contactEmail',
  'contactPhone',
  'contractType',
  'pricingModel',
  'billingCycle',
  'estimatedSkuCount',
  'estimatedBoxCount',
  'estimatedVolume',
  'averageStorageDays',
  'estimatedInboundPerWeek',
  'estimatedOutboundPerWeek',
  'requiresFastPicking',
  'requiresPremiumStorage',
  'notes',
  'suggestedZoneType',
  'suggestedRackType',
  'expectedStartDate',
  'expectedEndDate',
  'status',
  'reviewedBy',
  'reviewedAt',
  'rejectionReason',
  'reviewNote',
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

function parseNonNegativeInt(value, fieldName) {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new AppError(
      `${fieldName} must be a non-negative integer`,
      400,
      'VALIDATION_ERROR'
    );
  }
  return n;
}

function parseNonNegativeNumber(value, fieldName) {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new AppError(
      `${fieldName} must be a non-negative number`,
      400,
      'VALIDATION_ERROR'
    );
  }
  return n;
}

function parseDate(value, fieldName) {
  if (value == null) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} is not a valid date`, 400, 'VALIDATION_ERROR');
  }
  return date;
}

function generateRequestCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000)
    .toString(36)
    .toUpperCase()
    .padStart(2, '0');
  return `RR-${ts}-${rand}`;
}

function validateEnums(data) {
  assertEnum(data.contractType, CONTRACT_TYPE, 'contractType');
  assertEnum(data.pricingModel, PRICING_MODEL, 'pricingModel');
  assertEnum(data.billingCycle, BILLING_CYCLE, 'billingCycle');
  assertEnum(data.suggestedZoneType, ZONE_TYPE, 'suggestedZoneType');
  assertEnum(data.suggestedRackType, RACK_TYPE, 'suggestedRackType');
  assertEnum(data.status, RENTAL_REQUEST_STATUS, 'status');
}

function normalizeNumericFields(data) {
  if (data.estimatedSkuCount !== undefined)
    data.estimatedSkuCount = parseNonNegativeInt(data.estimatedSkuCount, 'estimatedSkuCount');
  if (data.estimatedBoxCount !== undefined)
    data.estimatedBoxCount = parseNonNegativeInt(data.estimatedBoxCount, 'estimatedBoxCount');
  if (data.averageStorageDays !== undefined)
    data.averageStorageDays = parseNonNegativeInt(
      data.averageStorageDays,
      'averageStorageDays'
    );
  if (data.estimatedInboundPerWeek !== undefined)
    data.estimatedInboundPerWeek = parseNonNegativeInt(
      data.estimatedInboundPerWeek,
      'estimatedInboundPerWeek'
    );
  if (data.estimatedOutboundPerWeek !== undefined)
    data.estimatedOutboundPerWeek = parseNonNegativeInt(
      data.estimatedOutboundPerWeek,
      'estimatedOutboundPerWeek'
    );
  if (data.estimatedVolume !== undefined)
    data.estimatedVolume = parseNonNegativeNumber(data.estimatedVolume, 'estimatedVolume');
  if (data.expectedStartDate !== undefined)
    data.expectedStartDate = parseDate(data.expectedStartDate, 'expectedStartDate');
  if (data.expectedEndDate !== undefined)
    data.expectedEndDate = parseDate(data.expectedEndDate, 'expectedEndDate');
}

function normalizeCreatePayload(body, warehouseId) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.companyName?.trim()) {
    throw new AppError('companyName is required', 400, 'VALIDATION_ERROR');
  }
  data.companyName = data.companyName.trim();

  if (data.requestCode != null) {
    data.requestCode = String(data.requestCode).trim();
    if (!data.requestCode) {
      throw new AppError('requestCode cannot be empty', 400, 'VALIDATION_ERROR');
    }
  } else {
    data.requestCode = generateRequestCode();
  }

  if (data.contactEmail != null) data.contactEmail = String(data.contactEmail).trim();
  if (data.contactName != null) data.contactName = String(data.contactName).trim();
  if (data.contactPhone != null) data.contactPhone = String(data.contactPhone).trim();
  if (data.address != null) data.address = String(data.address).trim();

  if (data.status == null) data.status = 'PENDING';
  if (data.requiresFastPicking == null) data.requiresFastPicking = false;
  if (data.requiresPremiumStorage == null) data.requiresPremiumStorage = false;

  normalizeNumericFields(data);
  validateEnums(data);

  data.warehouseId = warehouseId;
  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.companyName != null) {
    data.companyName = String(data.companyName).trim();
    if (!data.companyName) {
      throw new AppError('companyName cannot be empty', 400, 'VALIDATION_ERROR');
    }
  }

  if (data.reviewedBy != null) data.reviewedBy = parseUuid(data.reviewedBy, 'reviewedBy');
  if (data.reviewedAt !== undefined) data.reviewedAt = parseDate(data.reviewedAt, 'reviewedAt');

  normalizeNumericFields(data);
  validateEnums(data);

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

export async function getRentalRequest(rentalRequestId) {
  const id = parseUuid(rentalRequestId, 'rentalRequestId');
  const item = await RentalRequest.findById(id);
  if (!item) {
    throw new AppError('Rental request not found', 404, 'NOT_FOUND');
  }
  return item;
}

export async function listRentalRequests({
  warehouseId,
  status,
  contractType,
  pricingModel,
  page,
  limit,
  offset,
}) {
  assertEnum(status, RENTAL_REQUEST_STATUS, 'status');
  assertEnum(contractType, CONTRACT_TYPE, 'contractType');
  assertEnum(pricingModel, PRICING_MODEL, 'pricingModel');

  const filters = {};
  if (warehouseId) {
    const whId = parseUuid(warehouseId, 'warehouseId');
    await getWarehouseById(whId);
    filters.warehouseId = whId;
  }
  if (status) filters.status = status;
  if (contractType) filters.contractType = contractType;
  if (pricingModel) filters.pricingModel = pricingModel;

  const [items, total] = await Promise.all([
    RentalRequest.findAll(filters, {
      orderBy: 'created_at DESC',
      limit,
      offset,
    }),
    RentalRequest.count(filters),
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

export async function createRentalRequest(warehouseId, body) {
  const whId = parseUuid(warehouseId, 'warehouseId');
  await getWarehouseById(whId);

  const data = normalizeCreatePayload(body, whId);
  return RentalRequest.create(data);
}

export async function updateRentalRequest(rentalRequestId, body) {
  const id = parseUuid(rentalRequestId, 'rentalRequestId');
  await getRentalRequest(id);

  const data = normalizeUpdatePayload(body);
  return RentalRequest.updateById(id, data);
}

export async function deleteRentalRequest(rentalRequestId) {
  const id = parseUuid(rentalRequestId, 'rentalRequestId');
  await getRentalRequest(id);

  const deleted = await RentalRequest.deleteById(id);
  if (!deleted) {
    throw new AppError('Rental request not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
