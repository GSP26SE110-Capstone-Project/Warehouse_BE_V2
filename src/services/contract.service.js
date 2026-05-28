import Contract from '../models/Contract.js';
import RentalRequest from '../models/RentalRequest.js';
import AppError from '../utils/AppError.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import {
  BILLING_CYCLE,
  BILLABLE_CONTRACT_TYPE,
  CONTRACT_STATUS,
  CONTRACT_TYPE,
  PRICING_MODEL,
} from '../constants/tenantOnboarding.js';
import { getWarehouseById } from './warehouse.service.js';
import { getTenantCompany } from './tenantCompany.service.js';
import { seedDefaultContractItems } from './contractDefaultItems.service.js';

const CREATE_FIELDS = [
  'contractCode',
  'contractName',
  'contractType',
  'pricingModel',
  'billingCycle',
  'allowDynamicRelocation',
  'autoRenew',
  'startDate',
  'endDate',
  'minimumBillingDays',
  'minimumReservedCapacity',
  'estimatedTotalAmount',
  'status',
  'tenantSignature',
  'warehouseSignature',
  'createdBy',
  'approvedBy',
];

const UPDATE_FIELDS = [
  'contractName',
  'contractType',
  'pricingModel',
  'billingCycle',
  'allowDynamicRelocation',
  'autoRenew',
  'startDate',
  'endDate',
  'minimumBillingDays',
  'minimumReservedCapacity',
  'estimatedTotalAmount',
  'status',
  'tenantSignature',
  'warehouseSignature',
  'approvedBy',
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

function parseDateOnly(value, fieldName) {
  if (value == null) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} is not a valid date`, 400, 'VALIDATION_ERROR');
  }
  return date;
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

function generateContractCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000)
    .toString(36)
    .toUpperCase()
    .padStart(2, '0');
  return `CTR-${ts}-${rand}`;
}

function assertBillableContractType(contractType) {
  if (contractType == null) return;
  assertEnum(contractType, CONTRACT_TYPE, 'contractType');
  if (!BILLABLE_CONTRACT_TYPE.includes(contractType)) {
    throw new AppError(
      'NEEDS_CONSULTATION chỉ dùng trên yêu cầu thuê — chọn loại thuê cụ thể khi tạo hợp đồng',
      400,
      'VALIDATION_ERROR'
    );
  }
}

function validateEnums(data) {
  assertBillableContractType(data.contractType);
  assertEnum(data.pricingModel, PRICING_MODEL, 'pricingModel');
  assertEnum(data.billingCycle, BILLING_CYCLE, 'billingCycle');
  assertEnum(data.status, CONTRACT_STATUS, 'status');
}

function normalizeNumericFields(data) {
  if (data.startDate !== undefined)
    data.startDate = parseDateOnly(data.startDate, 'startDate');
  if (data.endDate !== undefined) data.endDate = parseDateOnly(data.endDate, 'endDate');
  if (data.minimumBillingDays !== undefined)
    data.minimumBillingDays = parseNonNegativeInt(
      data.minimumBillingDays,
      'minimumBillingDays'
    );
  if (data.minimumReservedCapacity !== undefined)
    data.minimumReservedCapacity = parseNonNegativeNumber(
      data.minimumReservedCapacity,
      'minimumReservedCapacity'
    );
  if (data.estimatedTotalAmount !== undefined)
    data.estimatedTotalAmount = parseNonNegativeNumber(
      data.estimatedTotalAmount,
      'estimatedTotalAmount'
    );
}

async function normalizeCreatePayload(body, tenantId, warehouseId) {
  const data = pickFields(body, CREATE_FIELDS);

  if (data.contractCode != null) {
    data.contractCode = String(data.contractCode).trim();
    if (!data.contractCode) {
      throw new AppError('contractCode cannot be empty', 400, 'VALIDATION_ERROR');
    }
  } else {
    data.contractCode = generateContractCode();
  }

  if (!data.contractType) {
    throw new AppError('contractType is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.pricingModel) {
    throw new AppError('pricingModel is required', 400, 'VALIDATION_ERROR');
  }
  if (data.startDate == null) {
    throw new AppError('startDate is required', 400, 'VALIDATION_ERROR');
  }
  if (data.endDate == null) {
    throw new AppError('endDate is required', 400, 'VALIDATION_ERROR');
  }

  if (data.contractName != null) data.contractName = String(data.contractName).trim();
  if (data.status == null) data.status = 'DRAFT';

  normalizeNumericFields(data);
  validateEnums(data);

  if (data.startDate >= data.endDate) {
    throw new AppError('endDate must be after startDate', 400, 'VALIDATION_ERROR');
  }

  if (data.createdBy != null) data.createdBy = parseUuid(data.createdBy, 'createdBy');
  if (data.approvedBy != null) data.approvedBy = parseUuid(data.approvedBy, 'approvedBy');

  data.tenantId = tenantId;
  data.warehouseId = warehouseId;
  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.contractName != null) data.contractName = String(data.contractName).trim();
  if (data.approvedBy != null) data.approvedBy = parseUuid(data.approvedBy, 'approvedBy');

  normalizeNumericFields(data);
  validateEnums(data);

  if (data.startDate && data.endDate && data.startDate >= data.endDate) {
    throw new AppError('endDate must be after startDate', 400, 'VALIDATION_ERROR');
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

async function attachRentalRequest(data, rentalRequestId) {
  if (rentalRequestId == null) return;
  const rrId = parseUuid(rentalRequestId, 'rentalRequestId');

  const existing = await RentalRequest.findById(rrId);
  if (!existing) {
    throw new AppError('Rental request not found', 404, 'NOT_FOUND');
  }

  const linked = await Contract.findOne({ rentalRequestId: rrId });
  if (linked) {
    throw new AppError(
      'Rental request is already linked to another contract',
      409,
      'DUPLICATE'
    );
  }

  data.rentalRequestId = rrId;
}

export async function getContract(contractId) {
  const id = parseUuid(contractId, 'contractId');
  const contract = await Contract.findById(id);
  if (!contract) {
    throw new AppError('Contract not found', 404, 'NOT_FOUND');
  }
  return contract;
}

export async function listContracts({
  tenantId,
  warehouseId,
  rentalRequestId,
  status,
  contractType,
  page,
  limit,
  offset,
}) {
  assertEnum(status, CONTRACT_STATUS, 'status');
  assertEnum(contractType, CONTRACT_TYPE, 'contractType');

  const filters = {};
  if (tenantId) filters.tenantId = parseUuid(tenantId, 'tenantId');
  if (warehouseId) filters.warehouseId = parseUuid(warehouseId, 'warehouseId');
  if (rentalRequestId)
    filters.rentalRequestId = parseUuid(rentalRequestId, 'rentalRequestId');
  if (status) filters.status = status;
  if (contractType) filters.contractType = contractType;

  const [items, total] = await Promise.all([
    Contract.findAll(filters, {
      orderBy: 'created_at DESC',
      limit,
      offset,
    }),
    Contract.count(filters),
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

export async function createContract(tenantId, warehouseId, body) {
  const tId = parseUuid(tenantId, 'tenantId');
  const wId = parseUuid(warehouseId, 'warehouseId');

  await getTenantCompany(tId);
  await getWarehouseById(wId);

  const data = await normalizeCreatePayload(body, tId, wId);
  await attachRentalRequest(data, body.rentalRequestId);

  const contract = await Contract.create(data);
  await seedDefaultContractItems(contract.contractId);
  return contract;
}

export async function updateContract(contractId, body) {
  const id = parseUuid(contractId, 'contractId');
  await getContract(id);

  const data = normalizeUpdatePayload(body);
  return Contract.updateById(id, data);
}

export async function deleteContract(contractId) {
  const id = parseUuid(contractId, 'contractId');
  await getContract(id);

  const deleted = await Contract.deleteById(id);
  if (!deleted) {
    throw new AppError('Contract not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
