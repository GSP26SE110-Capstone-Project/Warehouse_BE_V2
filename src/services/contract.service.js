import Contract from '../models/Contract.js';
import StorageReservation from '../models/StorageReservation.js';
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
import {
  notifyTenantAdminContractPendingApproval,
  notifyWarehouseAdminContractSigned,
} from './contractNotify.service.js';
import {
  assertInitialInvoicePaid,
  createInitialInvoice,
} from './contractInvoice.service.js';
import { estimateContractPrice } from './contractPriceEstimate.service.js';
import {
  resolveContractDatesFromApproval,
  toIsoDateOnly,
  startOfDayLocal,
} from '../utils/rentalEffectiveDates.js';

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

function serializeContractForApi(contract) {
  if (!contract) return contract;
  return {
    ...contract,
    startDate: toIsoDateOnly(contract.startDate) ?? contract.startDate,
    endDate: toIsoDateOnly(contract.endDate) ?? contract.endDate,
  };
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
      'CONTRACT_ALREADY_LINKED'
    );
  }

  data.rentalRequestId = rrId;
}

async function applyRentalLinkedEffectiveContractDates(data, rentalRequestId) {
  if (rentalRequestId == null) return;

  const rr = await RentalRequest.findById(parseUuid(rentalRequestId, 'rentalRequestId'));
  if (!rr?.expectedEndDate) {
    if (data.startDate != null) {
      assertRentalLinkedContractStartNotPast(data);
    }
    return;
  }

  const approveIso =
    toIsoDateOnly(rr.reviewedAt) ?? toIsoDateOnly(data.startDate) ?? startOfDayLocal();

  const resolved = resolveContractDatesFromApproval(
    rr.expectedStartDate ?? approveIso,
    rr.expectedEndDate,
    approveIso
  );

  data.startDate = parseDateOnly(resolved.startDate, 'startDate');
  data.endDate = parseDateOnly(resolved.endDate, 'endDate');
  if (data.billingCycle == null) {
    data.billingCycle = 'MONTHLY';
  }
}

function assertRentalLinkedContractStartNotPast(data) {
  if (data.startDate == null) return;
  const startIso = toIsoDateOnly(data.startDate);
  const todayIso = startOfDayLocal();
  if (startIso && startIso < todayIso) {
    throw new AppError(
      'Ngày bắt đầu HĐ không được trước hôm nay. Dịch start lên ngày duyệt và giữ nguyên số tháng thuê khách đã chọn.',
      400,
      'VALIDATION_ERROR'
    );
  }
}

function hasEstimatedTotalAmount(contract) {
  const amount = Number(contract?.estimatedTotalAmount);
  return Number.isFinite(amount) && amount > 0;
}

async function resolveEstimatedTotalAmount(contract, user = null) {
  if (!contract?.rentalRequestId) return null;
  const estimate = await estimateContractPrice(
    contract.rentalRequestId,
    contract.warehouseId,
    user,
    {
      contractType: contract.contractType,
      startDate: contract.startDate,
      endDate: contract.endDate,
    }
  );
  const total = Number(estimate?.suggestedTotalAmount);
  return Number.isFinite(total) && total > 0 ? total : null;
}

/** Bổ sung giá ước tính từ rental request (SHARED_STORAGE = theo thùng) khi HĐ chưa lưu số tiền. */
async function enrichContractEstimatedTotal(contract, user = null) {
  if (!contract) return contract;
  let enriched = contract;
  if (!hasEstimatedTotalAmount(contract)) {
    try {
      const total = await resolveEstimatedTotalAmount(contract, user);
      if (total != null) {
        enriched = { ...contract, estimatedTotalAmount: total };
      }
    } catch (err) {
      console.warn('[contract] enrich estimated total failed:', err?.message ?? err);
    }
  }
  return serializeContractForApi(enriched);
}

export async function getContract(contractId, user = null) {
  const id = parseUuid(contractId, 'contractId');
  const contract = await Contract.findById(id);
  if (!contract) {
    throw new AppError('Contract not found', 404, 'NOT_FOUND');
  }
  return enrichContractEstimatedTotal(contract, user);
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

  const enrichedItems = await Promise.all(
    items.map((item) => enrichContractEstimatedTotal(item))
  );

  return {
    items: enrichedItems,
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
  await applyRentalLinkedEffectiveContractDates(data, body.rentalRequestId);

  const contract = await Contract.create(data);
  await seedDefaultContractItems(contract.contractId);
  return serializeContractForApi(contract);
}

function applySignatureWorkflow(existing, data) {
  const whSigned =
    data.warehouseSignature !== undefined
      ? Boolean(String(data.warehouseSignature ?? '').trim())
      : Boolean(String(existing.warehouseSignature ?? '').trim());
  const tenantSigned =
    data.tenantSignature !== undefined
      ? Boolean(String(data.tenantSignature ?? '').trim())
      : Boolean(String(existing.tenantSignature ?? '').trim());

  if (data.tenantSignature !== undefined && data.tenantSignature && !whSigned) {
    throw new AppError(
      'Kho phải ký hợp đồng trước khi tenant ký',
      400,
      'VALIDATION_ERROR'
    );
  }

  const bothSigned = tenantSigned && whSigned;
  const tenantJustSigning =
    data.tenantSignature !== undefined &&
    Boolean(String(data.tenantSignature ?? '').trim()) &&
    !Boolean(String(existing.tenantSignature ?? '').trim());

  if (bothSigned && (tenantJustSigning || existing.status === 'PENDING_APPROVAL')) {
    data.status = 'PENDING_PAYMENT';
  }
}

async function assertActiveStorageForTenantSign(contractId) {
  const count = await StorageReservation.count({ contractId, status: 'ACTIVE' });
  if (count === 0) {
    throw new AppError(
      'Kho chưa cấp vị trí lưu trữ — tenant chỉ ký sau khi hoàn tất cấp bin/zone',
      400,
      'STORAGE_NOT_ASSIGNED'
    );
  }
}

export async function updateContract(contractId, body) {
  const id = parseUuid(contractId, 'contractId');
  const existing = await Contract.findById(id);
  if (!existing) {
    throw new AppError('Contract not found', 404, 'NOT_FOUND');
  }

  const data = normalizeUpdatePayload(body);

  if (existing.rentalRequestId) {
    if (data.startDate !== undefined || data.endDate !== undefined) {
      await applyRentalLinkedEffectiveContractDates(data, existing.rentalRequestId);
    } else if (
      data.status === 'PENDING_APPROVAL' &&
      existing.status !== 'PENDING_APPROVAL'
    ) {
      data.startDate = existing.startDate;
      data.endDate = existing.endDate;
      await applyRentalLinkedEffectiveContractDates(data, existing.rentalRequestId);
    }
  }

  const nextStatus = data.status ?? existing.status;
  const willHaveAmount =
    data.estimatedTotalAmount !== undefined
      ? hasEstimatedTotalAmount({ estimatedTotalAmount: data.estimatedTotalAmount })
      : hasEstimatedTotalAmount(existing);
  if (
    nextStatus === 'PENDING_APPROVAL' &&
    !willHaveAmount &&
    existing.rentalRequestId
  ) {
    try {
      const total = await resolveEstimatedTotalAmount(existing);
      if (total != null) {
        data.estimatedTotalAmount = total;
      }
    } catch (err) {
      console.warn('[contract] auto price on PENDING_APPROVAL failed:', err?.message ?? err);
    }
  }
  if (data.tenantSignature !== undefined && data.tenantSignature) {
    await assertActiveStorageForTenantSign(id);
  }

  const tenantJustSigned =
    data.tenantSignature !== undefined &&
    Boolean(String(data.tenantSignature ?? '').trim()) &&
    !Boolean(String(existing.tenantSignature ?? '').trim());

  if (data.status === 'ACTIVE' && existing.status !== 'ACTIVE') {
    await assertInitialInvoicePaid(id);
  }

  applySignatureWorkflow(existing, data);
  const updated = await Contract.updateById(id, data);

  if (
    data.status === 'PENDING_APPROVAL' &&
    existing.status !== 'PENDING_APPROVAL'
  ) {
    void notifyTenantAdminContractPendingApproval(updated).catch((err) => {
      console.warn('[contract] tenant pending approval notify failed:', err?.message ?? err);
    });
  }

  if (tenantJustSigned && updated.status === 'PENDING_PAYMENT') {
    await createInitialInvoice(updated);
    void notifyWarehouseAdminContractSigned(updated).catch((err) => {
      console.warn('[contract] WH admin notify failed:', err?.message ?? err);
    });
  }

  return serializeContractForApi(updated);
}

export async function assertContractOperational(contractId) {
  const contract = await getContract(contractId);
  if (contract.status !== 'ACTIVE') {
    throw new AppError(
      'Contract must be ACTIVE to create an inbound request',
      400,
      'VALIDATION_ERROR'
    );
  }
  await assertInitialInvoicePaid(contractId);
  return contract;
}

/** Outbound liquidation: ACTIVE (bình thường) hoặc TERMINATED (xuất hết hàng sau chấm dứt). */
export async function assertContractAllowsOutbound(contractId) {
  const contract = await getContract(contractId);
  if (!['ACTIVE', 'TERMINATED'].includes(contract.status)) {
    throw new AppError(
      'Contract must be ACTIVE or TERMINATED to create an outbound request',
      400,
      'VALIDATION_ERROR'
    );
  }
  if (contract.status === 'ACTIVE') {
    await assertInitialInvoicePaid(contractId);
  }
  return contract;
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
