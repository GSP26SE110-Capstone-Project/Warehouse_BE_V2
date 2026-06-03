import ContractItem from '../models/ContractItem.js';
import AppError from '../utils/AppError.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import {
  BILLING_UNIT,
  INVOICE_ITEM_TYPE,
  STORAGE_LEVEL,
} from '../constants/tenantOnboarding.js';
import { BOX_TYPE } from '../constants/warehouseStructure.js';
import { getContract } from './contract.service.js';

const CREATE_FIELDS = [
  'itemType',
  'storageLevel',
  'billingUnit',
  'quantity',
  'reservedQuantity',
  'boxType',
  'unitPrice',
  'appendixId',
];

const UPDATE_FIELDS = [
  'itemType',
  'storageLevel',
  'billingUnit',
  'quantity',
  'reservedQuantity',
  'boxType',
  'unitPrice',
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

function validateEnums(data) {
  assertEnum(data.itemType, INVOICE_ITEM_TYPE, 'itemType');
  assertEnum(data.billingUnit, BILLING_UNIT, 'billingUnit');
  assertEnum(data.storageLevel, STORAGE_LEVEL, 'storageLevel');
  assertEnum(data.boxType, BOX_TYPE, 'boxType');
}

function normalizeCreatePayload(body, contractId) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.itemType) {
    throw new AppError('itemType is required', 400, 'VALIDATION_ERROR');
  }
  if (!data.billingUnit) {
    throw new AppError('billingUnit is required', 400, 'VALIDATION_ERROR');
  }
  if (data.unitPrice == null) {
    throw new AppError('unitPrice is required', 400, 'VALIDATION_ERROR');
  }

  if (data.quantity !== undefined)
    data.quantity = parseNonNegativeNumber(data.quantity, 'quantity');
  if (data.reservedQuantity !== undefined)
    data.reservedQuantity = parseNonNegativeInt(data.reservedQuantity, 'reservedQuantity');
  data.unitPrice = parseNonNegativeNumber(data.unitPrice, 'unitPrice');

  validateEnums(data);

  data.contractId = contractId;
  if (data.appendixId != null) {
    data.appendixId = parseUuid(data.appendixId, 'appendixId');
  }
  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.quantity !== undefined)
    data.quantity = parseNonNegativeNumber(data.quantity, 'quantity');
  if (data.reservedQuantity !== undefined)
    data.reservedQuantity = parseNonNegativeInt(data.reservedQuantity, 'reservedQuantity');
  if (data.unitPrice !== undefined)
    data.unitPrice = parseNonNegativeNumber(data.unitPrice, 'unitPrice');

  validateEnums(data);

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }
  return data;
}

export async function getContractItem(contractItemId) {
  const id = parseUuid(contractItemId, 'contractItemId');
  const item = await ContractItem.findById(id);
  if (!item) {
    throw new AppError('Contract item not found', 404, 'NOT_FOUND');
  }
  return item;
}

export async function listContractItems(contractId, { page, limit, offset }) {
  const cId = parseUuid(contractId, 'contractId');
  await getContract(cId);

  const filters = { contractId: cId };

  const [items, total] = await Promise.all([
    ContractItem.findAll(filters, {
      orderBy: 'created_at ASC',
      limit,
      offset,
    }),
    ContractItem.count(filters),
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

export async function createContractItem(contractId, body) {
  const cId = parseUuid(contractId, 'contractId');
  await getContract(cId);

  const data = normalizeCreatePayload(body, cId);
  return ContractItem.create(data);
}

export async function updateContractItem(contractItemId, body) {
  const id = parseUuid(contractItemId, 'contractItemId');
  await getContractItem(id);

  const data = normalizeUpdatePayload(body);
  return ContractItem.updateById(id, data);
}

export async function deleteContractItem(contractItemId) {
  const id = parseUuid(contractItemId, 'contractItemId');
  await getContractItem(id);

  const deleted = await ContractItem.deleteById(id);
  if (!deleted) {
    throw new AppError('Contract item not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
