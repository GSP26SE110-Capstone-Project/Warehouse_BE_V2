import pool from '../config/db.js';
import ContractAppendix from '../models/ContractAppendix.js';
import ContractItem from '../models/ContractItem.js';
import StorageReservation from '../models/StorageReservation.js';
import AppError from '../utils/AppError.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import {
  CONTRACT_APPENDIX_STATUS,
  INVOICE_ITEM_TYPE,
  STORAGE_LEVEL,
} from '../constants/tenantOnboarding.js';
import { WAREHOUSE_ROLES } from '../constants/auth.js';
import {
  assertStorageLevelWithinCeiling,
  defaultCeilingFromContractType,
  isValidStorageLevel,
  maxProposedStorageLevel,
  maxStorageLevel,
} from '../utils/storageLevelRank.js';
import { assertContractScopeAccess } from '../utils/warehouseAccess.js';
import { getContract } from './contract.service.js';
import { createContractItem } from './contractItem.service.js';
import { createStorageReservation } from './storageReservation.service.js';
import { createAppendixInitialInvoice } from './contractAppendixInvoice.service.js';

const TENANT_SUBMIT_FIELDS = [
  'title',
  'effectiveDate',
  'endDate',
  'requestedStorageLevel',
];

const APPENDIX_REVIEW_STATUSES = ['PENDING', 'UNDER_REVIEW'];
const APPENDIX_TERMINATE_ON_CONTRACT_END = [
  'PENDING',
  'UNDER_REVIEW',
  'PENDING_APPROVAL',
  'PENDING_PAYMENT',
  'ACTIVE',
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

function generateAppendixCode(contractCode, appendixNumber) {
  return `${contractCode}-PL${String(appendixNumber).padStart(2, '0')}`;
}

async function nextAppendixNumber(contractId) {
  const row = await ContractAppendix.queryOne(
    `SELECT COALESCE(MAX(appendix_number), 0) + 1 AS n
     FROM contract_appendices WHERE contract_id = $1`,
    [contractId]
  );
  return Number(row?.n ?? 1);
}

export async function resolveContractStorageCeiling(contract) {
  const cId = contract.contractId;

  const [itemRows, resRows] = await Promise.all([
    pool.query(
      `SELECT storage_level FROM contract_items
       WHERE contract_id = $1 AND appendix_id IS NULL AND storage_level IS NOT NULL`,
      [cId]
    ),
    pool.query(
      `SELECT sr.storage_level
       FROM storage_reservations sr
       LEFT JOIN contract_appendices ca ON ca.appendix_id = sr.appendix_id
       WHERE sr.contract_id = $1
         AND sr.status = 'ACTIVE'
         AND (sr.appendix_id IS NULL OR ca.status = 'ACTIVE')`,
      [cId]
    ),
  ]);

  const levels = [
    ...itemRows.rows.map((r) => r.storage_level),
    ...resRows.rows.map((r) => r.storage_level),
  ].filter(isValidStorageLevel);

  const fromData = maxStorageLevel(levels);
  if (fromData) return fromData;
  return defaultCeilingFromContractType(contract.contractType);
}

function assertParentContractActive(contract) {
  const status = contract?.status ?? null;
  if (status !== 'ACTIVE') {
    throw new AppError(
      `Chỉ gửi phụ lục khi hợp đồng gốc đang ACTIVE (hiện tại: ${status ?? 'không xác định'})`,
      400,
      'VALIDATION_ERROR'
    );
  }
}

function assertAppendixDatesWithinContract(contract, effectiveDate, endDate) {
  const cStart = parseDateOnly(contract.startDate, 'startDate');
  const cEnd = parseDateOnly(contract.endDate, 'endDate');
  if (effectiveDate < cStart) {
    throw new AppError(
      'effectiveDate phụ lục không được trước startDate hợp đồng gốc',
      400,
      'VALIDATION_ERROR'
    );
  }
  if (endDate > cEnd) {
    throw new AppError(
      'endDate phụ lục không được sau endDate hợp đồng gốc',
      400,
      'VALIDATION_ERROR'
    );
  }
}

function validateAppendixPayloadLevels(body, ceilingLevel) {
  const proposed = maxProposedStorageLevel(body);
  if (!proposed) {
    if (body.requestedStorageLevel) {
      assertEnum(body.requestedStorageLevel, STORAGE_LEVEL, 'requestedStorageLevel');
      assertStorageLevelWithinCeiling(body.requestedStorageLevel, ceilingLevel);
    }
    return null;
  }
  assertStorageLevelWithinCeiling(proposed, ceilingLevel);
  return proposed;
}

function validateAppendixItemPayload(item, ceilingLevel) {
  if (item.storageLevel) {
    assertEnum(item.storageLevel, STORAGE_LEVEL, 'storageLevel');
    assertStorageLevelWithinCeiling(item.storageLevel, ceilingLevel);
  }
  if (item.itemType) {
    assertEnum(item.itemType, INVOICE_ITEM_TYPE, 'itemType');
  }
}

function validateReservationPayload(res, ceilingLevel) {
  assertEnum(res.storageLevel, STORAGE_LEVEL, 'storageLevel');
  assertStorageLevelWithinCeiling(res.storageLevel, ceilingLevel);
}

function assertTenantActor(actor, contract) {
  if (!actor || actor.role !== 'TENANT_ADMIN') {
    throw new AppError('Chỉ TENANT_ADMIN được gửi yêu cầu phụ lục', 403, 'FORBIDDEN');
  }
  assertContractScopeAccess(actor, contract);
}

function assertWarehouseActor(actor, contract) {
  if (!actor || !WAREHOUSE_ROLES.includes(actor.role)) {
    throw new AppError('Chỉ nhân viên kho được duyệt yêu cầu phụ lục', 403, 'FORBIDDEN');
  }
  assertContractScopeAccess(actor, contract);
}

async function attachAppendixScope(appendixId, contractId, contract, body, ceilingLevel, effectiveDate, endDate) {
  const items = Array.isArray(body.items) ? body.items : [];
  for (const raw of items) {
    validateAppendixItemPayload(raw, ceilingLevel);
    await createContractItem(contractId, { ...raw, appendixId });
  }

  const reservations = Array.isArray(body.reservations) ? body.reservations : [];
  for (const raw of reservations) {
    validateReservationPayload(raw, ceilingLevel);
    await createStorageReservation(contractId, {
      ...raw,
      appendixId,
      status: 'CANCELLED',
      startDate: raw.startDate ?? effectiveDate,
      endDate: raw.endDate ?? endDate,
    });
  }
}

async function assertAppendixHasScope(appendixId) {
  const [items, reservations] = await Promise.all([
    ContractItem.count({ appendixId }),
    StorageReservation.count({ appendixId }),
  ]);
  if (items === 0 && reservations === 0) {
    throw new AppError(
      'Phụ lục cần ít nhất một contract item hoặc storage reservation (kho cấp khi duyệt)',
      400,
      'VALIDATION_ERROR'
    );
  }
}

export async function getContractAppendix(contractId, appendixId, actor = null) {
  const cId = parseUuid(contractId, 'contractId');
  const aId = parseUuid(appendixId, 'appendixId');
  const contract = await getContract(cId);
  assertContractScopeAccess(actor, contract);
  const appendix = await ContractAppendix.findById(aId);
  if (!appendix || appendix.contractId !== cId) {
    throw new AppError('Phụ lục không tồn tại', 404, 'NOT_FOUND');
  }
  return appendix;
}

export async function listContractAppendices(
  contractId,
  { status, page, limit, offset } = {},
  actor = null
) {
  const cId = parseUuid(contractId, 'contractId');
  const contract = await getContract(cId);
  assertContractScopeAccess(actor, contract);

  if (status != null && String(status).trim() !== '') {
    assertEnum(String(status).trim(), CONTRACT_APPENDIX_STATUS, 'status');
  }

  const filters = { contractId: cId };
  if (status) filters.status = String(status).trim();

  const [items, total] = await Promise.all([
    ContractAppendix.findAll(filters, {
      orderBy: 'appendix_number ASC',
      limit,
      offset,
    }),
    ContractAppendix.count(filters),
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

/** Tenant gửi yêu cầu thuê thêm (phụ lục). */
export async function submitAppendixRequest(contractId, body = {}, actor = null) {
  const cId = parseUuid(contractId, 'contractId');
  const contract = await getContract(cId);
  assertParentContractActive(contract);
  assertTenantActor(actor, contract);

  const ceilingLevel = await resolveContractStorageCeiling(contract);
  validateAppendixPayloadLevels(body, ceilingLevel);

  const data = pickFields(body, TENANT_SUBMIT_FIELDS);
  if (data.effectiveDate == null) {
    throw new AppError('effectiveDate is required', 400, 'VALIDATION_ERROR');
  }
  if (data.endDate == null) {
    throw new AppError('endDate is required', 400, 'VALIDATION_ERROR');
  }

  data.effectiveDate = parseDateOnly(data.effectiveDate, 'effectiveDate');
  data.endDate = parseDateOnly(data.endDate, 'endDate');
  if (data.effectiveDate >= data.endDate) {
    throw new AppError('endDate must be after effectiveDate', 400, 'VALIDATION_ERROR');
  }
  assertAppendixDatesWithinContract(contract, data.effectiveDate, data.endDate);

  if (data.title != null) data.title = String(data.title).trim();
  if (data.requestedStorageLevel != null) {
    assertEnum(data.requestedStorageLevel, STORAGE_LEVEL, 'requestedStorageLevel');
  }

  const proposedLevel =
    maxProposedStorageLevel(body) ?? data.requestedStorageLevel ?? null;

  const appendixNumber = await nextAppendixNumber(cId);
  const appendixCode = generateAppendixCode(contract.contractCode, appendixNumber);

  const appendix = await ContractAppendix.create({
    contractId: cId,
    appendixCode,
    appendixNumber,
    status: 'PENDING',
    maxStorageLevel: ceilingLevel,
    estimatedDeltaAmount: 0,
    requestedBy: actor.userId ?? null,
    requestedStorageLevel: proposedLevel,
    ...data,
  });

  const items = Array.isArray(body.items) ? body.items : [];
  for (const raw of items) {
    validateAppendixItemPayload(raw, ceilingLevel);
    await createContractItem(cId, {
      ...raw,
      appendixId: appendix.appendixId,
      unitPrice: raw.unitPrice ?? 0,
    });
  }

  return appendix;
}

/** WH duyệt — cấp bin/zone + giá → chờ tenant ký (không ký canvas tại bước duyệt). */
export async function approveAppendixRequest(
  contractId,
  appendixId,
  body = {},
  actor = null
) {
  const existing = await getContractAppendix(contractId, appendixId, actor);
  const contract = await getContract(existing.contractId);
  assertWarehouseActor(actor, contract);

  if (!APPENDIX_REVIEW_STATUSES.includes(existing.status)) {
    throw new AppError(
      'Chỉ duyệt yêu cầu phụ lục ở trạng thái PENDING hoặc UNDER_REVIEW',
      400,
      'VALIDATION_ERROR'
    );
  }

  if (body.estimatedDeltaAmount == null) {
    throw new AppError(
      'estimatedDeltaAmount (đơn giá/tháng) bắt buộc khi duyệt',
      400,
      'VALIDATION_ERROR'
    );
  }
  const warehouseSignature =
    body.warehouseSignature != null && String(body.warehouseSignature).trim()
      ? String(body.warehouseSignature).trim()
      : 'SIGNED_WH_APPENDIX_APPROVAL';

  const ceilingLevel =
    existing.maxStorageLevel ?? (await resolveContractStorageCeiling(contract));
  const effectiveDate = existing.effectiveDate;
  const endDate = existing.endDate;

  await attachAppendixScope(
    existing.appendixId,
    contract.contractId,
    contract,
    body,
    ceilingLevel,
    effectiveDate,
    endDate
  );
  await assertAppendixHasScope(existing.appendixId);

  const estimatedDeltaAmount = parseNonNegativeNumber(
    body.estimatedDeltaAmount,
    'estimatedDeltaAmount'
  );
  if (estimatedDeltaAmount <= 0) {
    throw new AppError('estimatedDeltaAmount phải > 0', 400, 'VALIDATION_ERROR');
  }

  const reviewNote =
    body.reviewNote != null ? String(body.reviewNote).trim().slice(0, 2000) : null;

  const updated = await ContractAppendix.updateById(existing.appendixId, {
    status: 'PENDING_APPROVAL',
    estimatedDeltaAmount,
    warehouseSignature,
    reviewNote,
    approvedBy: actor?.userId ?? null,
    reviewedBy: actor?.userId ?? null,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  });

  return updated;
}

/** WH từ chối yêu cầu phụ lục. */
export async function rejectAppendixRequest(
  contractId,
  appendixId,
  body = {},
  actor = null
) {
  const existing = await getContractAppendix(contractId, appendixId, actor);
  const contract = await getContract(existing.contractId);
  assertWarehouseActor(actor, contract);

  if (!APPENDIX_REVIEW_STATUSES.includes(existing.status)) {
    throw new AppError(
      'Chỉ từ chối yêu cầu ở trạng thái PENDING hoặc UNDER_REVIEW',
      400,
      'VALIDATION_ERROR'
    );
  }

  const reason = body.rejectionReason ?? body.reason;
  if (reason == null || !String(reason).trim()) {
    throw new AppError('rejectionReason is required', 400, 'VALIDATION_ERROR');
  }

  const reviewNote =
    body.reviewNote != null ? String(body.reviewNote).trim().slice(0, 2000) : null;

  return ContractAppendix.updateById(existing.appendixId, {
    status: 'REJECTED',
    rejectionReason: String(reason).trim().slice(0, 2000),
    reviewNote,
    reviewedBy: actor?.userId ?? null,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  });
}

/** WH đánh dấu đang xem xét. */
export async function markAppendixUnderReview(contractId, appendixId, actor = null) {
  const existing = await getContractAppendix(contractId, appendixId, actor);
  const contract = await getContract(existing.contractId);
  assertWarehouseActor(actor, contract);

  if (existing.status !== 'PENDING') {
    throw new AppError('Chỉ chuyển UNDER_REVIEW từ PENDING', 400, 'VALIDATION_ERROR');
  }

  return ContractAppendix.updateById(existing.appendixId, {
    status: 'UNDER_REVIEW',
    updatedAt: new Date(),
  });
}

/** Tenant ký sau khi WH duyệt → tạo invoice thanh toán. */
export async function signAppendixAsTenant(contractId, appendixId, body = {}, actor = null) {
  const existing = await getContractAppendix(contractId, appendixId, actor);
  const contract = await getContract(existing.contractId);
  assertTenantActor(actor, contract);

  if (existing.status !== 'PENDING_APPROVAL') {
    throw new AppError(
      'Chỉ ký phụ lục khi kho đã duyệt (PENDING_APPROVAL)',
      400,
      'VALIDATION_ERROR'
    );
  }
  if (!String(existing.warehouseSignature ?? '').trim()) {
    throw new AppError('Kho chưa duyệt phụ lục', 400, 'VALIDATION_ERROR');
  }
  if (!body.tenantSignature || !String(body.tenantSignature).trim()) {
    throw new AppError('tenantSignature is required', 400, 'VALIDATION_ERROR');
  }

  const updated = await ContractAppendix.updateById(existing.appendixId, {
    tenantSignature: String(body.tenantSignature).trim(),
    status: 'PENDING_PAYMENT',
    updatedAt: new Date(),
  });

  await createAppendixInitialInvoice(updated, contract);
  return updated;
}

/** @deprecated Dùng submitAppendixRequest — giữ alias tạm. */
export async function createContractAppendix(contractId, body = {}, actor = null) {
  return submitAppendixRequest(contractId, body, actor);
}

export async function terminateContractAppendix(contractId, appendixId, body = {}, actor = null) {
  const appendix = await getContractAppendix(contractId, appendixId, actor);

  if (appendix.status !== 'ACTIVE') {
    throw new AppError(
      'Chỉ chấm dứt phụ lục đang ACTIVE',
      400,
      'VALIDATION_ERROR'
    );
  }

  const reason =
    body.reason != null ? String(body.reason).trim().slice(0, 2000) : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE contract_appendices
       SET status = 'TERMINATED',
           terminated_at = NOW(),
           termination_reason = $2,
           updated_at = NOW()
       WHERE appendix_id = $1`,
      [appendix.appendixId, reason || null]
    );
    await client.query(
      `UPDATE storage_reservations
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE appendix_id = $1 AND status = 'ACTIVE'`,
      [appendix.appendixId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return getContractAppendix(contractId, appendixId, actor);
}

export async function terminateAllAppendicesForContract(client, contractId) {
  await client.query(
    `UPDATE contract_appendices
     SET status = 'TERMINATED',
         terminated_at = NOW(),
         termination_reason = 'Hợp đồng gốc đã chấm dứt',
         updated_at = NOW()
     WHERE contract_id = $1
       AND status IN ('PENDING', 'UNDER_REVIEW', 'PENDING_APPROVAL', 'PENDING_PAYMENT', 'ACTIVE')`,
    [contractId]
  );

  await client.query(
    `UPDATE storage_reservations
     SET status = 'CANCELLED', updated_at = NOW()
     WHERE contract_id = $1
       AND appendix_id IS NOT NULL
       AND status = 'ACTIVE'`,
    [contractId]
  );
}

export async function deleteContractAppendix(contractId, appendixId, actor = null) {
  const appendix = await getContractAppendix(contractId, appendixId, actor);
  if (!['PENDING', 'REJECTED', 'CANCELLED'].includes(appendix.status)) {
    throw new AppError(
      'Chỉ xóa yêu cầu phụ lục PENDING, REJECTED hoặc CANCELLED',
      400,
      'VALIDATION_ERROR'
    );
  }
  if (actor?.role === 'TENANT_ADMIN') {
    const contract = await getContract(appendix.contractId);
    assertTenantActor(actor, contract);
  }
  const deleted = await ContractAppendix.deleteById(appendix.appendixId);
  if (!deleted) {
    throw new AppError('Phụ lục không tồn tại', 404, 'NOT_FOUND');
  }
  return deleted;
}
