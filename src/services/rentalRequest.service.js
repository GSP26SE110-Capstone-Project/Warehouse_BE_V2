import RentalRequest from '../models/RentalRequest.js';
import pool from '../config/db.js';
import AppError from '../utils/AppError.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { locationMatches, requireLocationField } from '../utils/location.js';
import { resolveCityDistrict } from './location.service.js';
import { ZONE_TYPE, RACK_TYPE } from '../constants/warehouseStructure.js';
import {
  BILLING_CYCLE,
  BILLABLE_CONTRACT_TYPE,
  CONTRACT_TYPE,
  PRICING_MODEL,
  RENTAL_REQUEST_STATUS,
} from '../constants/tenantOnboarding.js';
import {
  assertWarehouseCanClaimSharedStorage,
  getWarehouseById,
} from './warehouse.service.js';
import { getTenantCompany } from './tenantCompany.service.js';
import { fromDbRecord } from '../models/utils/fieldMapper.js';
import { rentalRequestSchema } from '../models/RentalRequest.js';
import {
  assertWarehouseAccess,
  getScopedTenantId,
} from '../utils/warehouseAccess.js';
import { WAREHOUSE_ROLES } from '../constants/auth.js';
import {
  attachProductLinesToRentalRequest,
  enrichRentalRequestsWithProductLines,
  replaceProductLinesForRentalRequest,
  validateAndComputeProductLines,
} from './rentalRequestProductLine.service.js';
import {
  notifyTenantAdminRentalApproved,
  notifyTenantAdminRentalRejected,
} from './rentalNotify.service.js';

const CREATE_FIELDS = [
  'requestCode',
  'tenantId',
  'city',
  'district',
  'contractType',
  'pricingModel',
  'billingCycle',
  'estimatedSkuCount',
  'estimatedBoxCount',
  'estimatedVolume',
  'requestedAreaM2',
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
];

const UPDATE_FIELDS = [
  'contractType',
  'pricingModel',
  'billingCycle',
  'estimatedSkuCount',
  'estimatedBoxCount',
  'estimatedVolume',
  'requestedAreaM2',
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

const CLAIMABLE_STATUSES = ['PENDING', 'UNDER_REVIEW'];

function assertRentalRequestReadAccess(user, item) {
  if (!user) return;

  const scopedTenantId = getScopedTenantId(user);
  if (scopedTenantId) {
    if (item.tenantId !== scopedTenantId) {
      throw new AppError('Forbidden: rental request out of tenant scope', 403, 'FORBIDDEN');
    }
    return;
  }

  if (WAREHOUSE_ROLES.includes(user.role) && item.warehouseId) {
    assertWarehouseAccess(user, item.warehouseId);
  }
}

function applyRentalListScope(user, filters, { warehouseId, regionMatch } = {}) {
  const scopedTenantId = getScopedTenantId(user);
  if (scopedTenantId) {
    if (filters.tenantId && filters.tenantId !== scopedTenantId) {
      throw new AppError('Forbidden: tenant out of scope', 403, 'FORBIDDEN');
    }
    if (warehouseId || regionMatch === true || regionMatch === 'true') {
      throw new AppError('Forbidden: warehouse inbox not available for tenant users', 403, 'FORBIDDEN');
    }
    filters.tenantId = scopedTenantId;
    return;
  }

  if (user?.role === 'WH_ADMIN' && filters.warehouseId) {
    assertWarehouseAccess(user, filters.warehouseId);
  }
}

function pickFields(source, fields) {
  const result = {};
  for (const field of fields) {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
  }
  return result;
}

function mapRentalRow(row) {
  return row ? fromDbRecord(rentalRequestSchema, row) : null;
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
  if (data.requestedAreaM2 !== undefined)
    data.requestedAreaM2 = parseNonNegativeNumber(data.requestedAreaM2, 'requestedAreaM2');
  if (data.expectedStartDate !== undefined)
    data.expectedStartDate = parseDate(data.expectedStartDate, 'expectedStartDate');
  if (data.expectedEndDate !== undefined)
    data.expectedEndDate = parseDate(data.expectedEndDate, 'expectedEndDate');
}

function hasMinimumRentalDuration(startDate, endDate) {
  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs <= 0) return false;
  const diffDays = Math.ceil(diffMs / 86400000);
  return diffDays >= 30;
}

function startOfDayUtc(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function assertExpectedRentalDates(data) {
  if (data.expectedStartDate == null) {
    throw new AppError('expectedStartDate is required', 400, 'VALIDATION_ERROR');
  }
  if (data.expectedEndDate == null) {
    throw new AppError('expectedEndDate is required', 400, 'VALIDATION_ERROR');
  }
  const startDay = startOfDayUtc(data.expectedStartDate);
  const todayDay = startOfDayUtc(new Date());
  if (startDay < todayDay) {
    throw new AppError(
      'Ngày bắt đầu dự kiến không được trước hôm nay',
      400,
      'VALIDATION_ERROR'
    );
  }
  if (data.expectedStartDate >= data.expectedEndDate) {
    throw new AppError(
      'expectedEndDate must be after expectedStartDate',
      400,
      'VALIDATION_ERROR'
    );
  }
  if (!hasMinimumRentalDuration(data.expectedStartDate, data.expectedEndDate)) {
    throw new AppError(
      'Thời hạn thuê tối thiểu 1 tháng (ngày kết thúc phải sau ngày bắt đầu ít nhất 30 ngày)',
      400,
      'VALIDATION_ERROR'
    );
  }
}

function assertGuestCapacityEstimate(data, productLineSummary = null) {
  const hasArea =
    data.requestedAreaM2 != null && Number(data.requestedAreaM2) > 0;
  const hasBoxes =
    data.estimatedBoxCount != null && Number(data.estimatedBoxCount) > 0;
  const hasVolumeU =
    (productLineSummary?.totalCommittedVolumeUnits ?? 0) > 0 ||
    (data.totalCommittedVolumeUnits != null && Number(data.totalCommittedVolumeUnits) > 0);
  if (!hasArea && !hasBoxes && !hasVolumeU) {
    throw new AppError(
      'Cần nhập diện tích mong muốn (m²), quy mô hàng (cái/tháng hoặc thùng/tháng), hoặc productLines theo loại hàng + size',
      400,
      'VALIDATION_ERROR'
    );
  }
}

function normalizeLocationFields(data) {
  const city = requireLocationField(data.city, 'city');
  if (city.error) {
    throw new AppError(city.error, 400, 'VALIDATION_ERROR');
  }
  data.city = city.value;

  const district = requireLocationField(data.district, 'district');
  if (district.error) {
    throw new AppError(district.error, 400, 'VALIDATION_ERROR');
  }
  data.district = district.value;
}

async function assertKnownCityDistrict(data) {
  const resolved = await resolveCityDistrict(data.city, data.district);
  if (!resolved) {
    throw new AppError(
      'city and district must be a valid pair from the location catalog',
      400,
      'VALIDATION_ERROR'
    );
  }
  data.city = resolved.city;
  data.district = resolved.district;
}

function normalizeCreatePayload(body, { productLineSummary = null, actor = null } = {}) {
  const data = pickFields(body, CREATE_FIELDS);

  if (!data.tenantId) {
    throw new AppError('tenantId is required', 400, 'VALIDATION_ERROR');
  }
  data.tenantId = parseUuid(data.tenantId, 'tenantId');
  normalizeLocationFields(data);

  if (data.requestCode != null) {
    data.requestCode = String(data.requestCode).trim();
    if (!data.requestCode) {
      throw new AppError('requestCode cannot be empty', 400, 'VALIDATION_ERROR');
    }
  } else {
    data.requestCode = generateRequestCode();
  }

  if (data.status == null) data.status = 'PENDING';
  if (data.requiresFastPicking == null) data.requiresFastPicking = false;
  if (data.requiresPremiumStorage == null) data.requiresPremiumStorage = false;
  data.createdBy = actor?.userId ?? null;

  normalizeNumericFields(data);
  validateEnums(data);
  assertExpectedRentalDates(data);
  assertGuestCapacityEstimate(data, productLineSummary);

  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.reviewedBy != null) data.reviewedBy = parseUuid(data.reviewedBy, 'reviewedBy');
  if (data.reviewedAt !== undefined) data.reviewedAt = parseDate(data.reviewedAt, 'reviewedAt');

  normalizeNumericFields(data);
  validateEnums(data);

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

function assertWarehouseHasRegion(warehouse) {
  if (!warehouse.city?.trim() || !warehouse.district?.trim()) {
    throw new AppError(
      'Warehouse must have city and district configured for regional rental requests',
      400,
      'VALIDATION_ERROR'
    );
  }
}

function buildListConditions(filters, { regionMatchWarehouse } = {}) {
  const conditions = [];
  const params = [];

  const addEq = (column, value) => {
    params.push(value);
    conditions.push(`${column} = $${params.length}`);
  };

  const addLocationEq = (column, value) => {
    params.push(value);
    conditions.push(`LOWER(TRIM(${column})) = LOWER(TRIM($${params.length}))`);
  };

  if (regionMatchWarehouse) {
    assertWarehouseHasRegion(regionMatchWarehouse);
    conditions.push('warehouse_id IS NULL');
    addLocationEq('city', regionMatchWarehouse.city);
    addLocationEq('district', regionMatchWarehouse.district);
  } else if (filters.warehouseId) {
    addEq('warehouse_id', filters.warehouseId);
  }

  if (filters.tenantId) addEq('tenant_id', filters.tenantId);
  if (filters.status) addEq('status', filters.status);
  if (filters.contractType) addEq('contract_type', filters.contractType);
  if (filters.pricingModel) addEq('pricing_model', filters.pricingModel);
  if (filters.city) addLocationEq('city', filters.city);
  if (filters.district) addLocationEq('district', filters.district);

  return { conditions, params };
}

async function queryRentalRequests({ conditions, params, limit, offset }) {
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const listParams = [...params, limit, offset];

  const [items, countRow] = await Promise.all([
    RentalRequest.query(
      `SELECT * FROM rental_requests ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      listParams
    ),
    RentalRequest.queryOne(
      `SELECT COUNT(*)::int AS count FROM rental_requests ${where}`,
      params
    ),
  ]);

  return {
    items: items.map(mapRentalRow),
    total: countRow?.count ?? 0,
  };
}

export async function getRentalRequest(rentalRequestId, user = null) {
  const id = parseUuid(rentalRequestId, 'rentalRequestId');
  const item = await RentalRequest.findById(id);
  if (!item) {
    throw new AppError('Rental request not found', 404, 'NOT_FOUND');
  }
  assertRentalRequestReadAccess(user, item);
  return attachProductLinesToRentalRequest(item);
}

export async function lookupRentalRequestByCode(requestCode, email) {
  const code = String(requestCode ?? '').trim();
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!code) {
    throw new AppError('requestCode is required', 400, 'VALIDATION_ERROR');
  }
  if (!normalizedEmail) {
    throw new AppError('email is required', 400, 'VALIDATION_ERROR');
  }

  const row = await RentalRequest.queryOne(
    `SELECT * FROM rental_requests
     WHERE UPPER(TRIM(request_code)) = UPPER(TRIM($1))
     LIMIT 1`,
    [code]
  );
  const item = mapRentalRow(row);
  if (!item) {
    throw new AppError('Rental request not found', 404, 'NOT_FOUND');
  }

  const tenant = await getTenantCompany(item.tenantId);
  const tenantEmail = String(tenant.contactEmail ?? '').trim().toLowerCase();
  if (!tenantEmail || tenantEmail !== normalizedEmail) {
    throw new AppError('Rental request not found', 404, 'NOT_FOUND');
  }

  const enriched = await attachProductLinesToRentalRequest(item);

  let warehouseName = null;
  if (enriched.warehouseId) {
    const warehouse = await getWarehouseById(enriched.warehouseId);
    warehouseName = warehouse.warehouseName ?? null;
  }

  return {
    requestCode: enriched.requestCode,
    status: enriched.status,
    companyName: tenant.companyName,
    city: enriched.city,
    district: enriched.district,
    contractType: enriched.contractType ?? null,
    pricingModel: enriched.pricingModel ?? null,
    billingCycle: enriched.billingCycle ?? null,
    estimatedBoxCount: enriched.estimatedBoxCount ?? null,
    estimatedSkuCount: enriched.estimatedSkuCount ?? null,
    totalCommittedVolumeUnits: enriched.totalCommittedVolumeUnits ?? null,
    boxAllocation: enriched.boxAllocation ?? [],
    productLines: enriched.productLines ?? [],
    estimatedInboundPerWeek: enriched.estimatedInboundPerWeek ?? null,
    estimatedOutboundPerWeek: enriched.estimatedOutboundPerWeek ?? null,
    requestedAreaM2: enriched.requestedAreaM2 ?? null,
    requiresFastPicking: enriched.requiresFastPicking ?? false,
    requiresPremiumStorage: enriched.requiresPremiumStorage ?? false,
    expectedStartDate: enriched.expectedStartDate ?? null,
    expectedEndDate: enriched.expectedEndDate ?? null,
    rejectionReason: enriched.rejectionReason ?? null,
    reviewNote: enriched.reviewNote ?? null,
    warehouseName,
    createdAt: enriched.createdAt ?? null,
    updatedAt: enriched.updatedAt ?? null,
    reviewedAt: enriched.reviewedAt ?? null,
  };
}

export async function listRentalRequests({
  tenantId,
  warehouseId,
  regionMatch,
  city,
  district,
  status,
  contractType,
  pricingModel,
  includeProductLines,
  page,
  limit,
  offset,
  user = null,
}) {
  assertEnum(status, RENTAL_REQUEST_STATUS, 'status');
  assertEnum(contractType, CONTRACT_TYPE, 'contractType');
  assertEnum(pricingModel, PRICING_MODEL, 'pricingModel');

  const filters = {};
  if (tenantId) {
    const tId = parseUuid(tenantId, 'tenantId');
    await getTenantCompany(tId);
    filters.tenantId = tId;
  }
  if (city) filters.city = String(city).trim();
  if (district) filters.district = String(district).trim();

  let regionMatchWarehouse = null;
  if (warehouseId) {
    const whId = parseUuid(warehouseId, 'warehouseId');
    const warehouse = await getWarehouseById(whId);
    if (regionMatch === true || regionMatch === 'true') {
      regionMatchWarehouse = warehouse;
    } else {
      filters.warehouseId = whId;
    }
  }

  applyRentalListScope(user, filters, { warehouseId, regionMatch });

  if (status) filters.status = status;
  if (contractType) filters.contractType = contractType;
  if (pricingModel) filters.pricingModel = pricingModel;

  const { conditions, params } = buildListConditions(filters, { regionMatchWarehouse });
  const { items, total } = await queryRentalRequests({ conditions, params, limit, offset });
  const shouldIncludeLines = includeProductLines === true || includeProductLines === 'true';
  const enrichedItems = shouldIncludeLines
    ? await enrichRentalRequestsWithProductLines(items)
    : items;

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

export async function createRentalRequest(body, actor = null) {
  const { productLines, selectedBoxTypeHint } = body;
  let productLineSummary = null;

  if (productLines != null) {
    if (!Array.isArray(productLines)) {
      throw new AppError('productLines must be an array', 400, 'VALIDATION_ERROR');
    }
    if (productLines.length > 0) {
      productLineSummary = await validateAndComputeProductLines(productLines);
    }
  }

  const data = normalizeCreatePayload(body, { productLineSummary, actor });
  await assertKnownCityDistrict(data);
  await getTenantCompany(data.tenantId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let item = await RentalRequest.create(data, client);

    if (productLines?.length) {
      await replaceProductLinesForRentalRequest(
        item.rentalRequestId,
        productLines,
        { selectedBoxTypeHint },
        client
      );
      item = await RentalRequest.findById(item.rentalRequestId, client);
    }

    await client.query('COMMIT');
    return attachProductLinesToRentalRequest(item, client);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function assertWarehouseExclusiveForDedicatedLease(warehouseId, tenantId) {
  const whId = parseUuid(warehouseId, 'warehouseId');
  const tid = parseUuid(tenantId, 'tenantId');

  const result = await pool.query(
    `SELECT c.contract_id, tc.company_name, c.status
     FROM contracts c
     INNER JOIN tenant_companies tc ON tc.tenant_id = c.tenant_id
     WHERE c.warehouse_id = $1
       AND c.tenant_id != $2
       AND c.status IN ('PENDING_APPROVAL', 'ACTIVE')
     LIMIT 1`,
    [whId, tid]
  );

  if (result.rowCount > 0) {
    const row = result.rows[0];
    throw new AppError(
      `Không thể thuê nguyên kho: đang có hợp đồng ${row.status} với tenant khác (${row.company_name}). Chọn kho khác hoặc loại thuê khác.`,
      409,
      'WAREHOUSE_EXCLUSIVE_LEASE_CONFLICT'
    );
  }
}

async function claimRentalRequest(rentalRequestId, warehouseId, body) {
  const id = parseUuid(rentalRequestId, 'rentalRequestId');
  const whId = parseUuid(warehouseId, 'warehouseId');
  const warehouse = await getWarehouseById(whId);
  assertWarehouseHasRegion(warehouse);

  const existing = await getRentalRequest(id);
  if (existing.warehouseId && existing.warehouseId !== whId) {
    throw new AppError(
      'Rental request already claimed by another warehouse',
      409,
      'ALREADY_CLAIMED'
    );
  }
  if (existing.warehouseId === whId && existing.status === 'APPROVED') {
    return existing;
  }
  if (!locationMatches(existing.city, warehouse.city) || !locationMatches(existing.district, warehouse.district)) {
    throw new AppError(
      'Warehouse region does not match rental request city/district',
      400,
      'VALIDATION_ERROR'
    );
  }

  const reviewedBy =
    body.reviewedBy != null ? parseUuid(body.reviewedBy, 'reviewedBy') : undefined;
  const reviewedAt =
    body.reviewedAt !== undefined ? parseDate(body.reviewedAt, 'reviewedAt') : new Date();

  // Allow WH_ADMIN to adjust contractType/pricingModel before activation.
  // Note: assertEnum ignores null/undefined, so it's safe to keep them optional.
  assertEnum(body.contractType, CONTRACT_TYPE, 'contractType');
  assertEnum(body.pricingModel, PRICING_MODEL, 'pricingModel');
  if (body.contractType === 'NEEDS_CONSULTATION') {
    throw new AppError(
      'Khi duyệt yêu cầu, warehouse admin phải chọn loại thuê cụ thể (không dùng NEEDS_CONSULTATION)',
      400,
      'VALIDATION_ERROR'
    );
  }
  if (
    body.contractType != null &&
    !BILLABLE_CONTRACT_TYPE.includes(body.contractType)
  ) {
    throw new AppError('contractType is not billable', 400, 'VALIDATION_ERROR');
  }
  if (
    existing.contractType === 'NEEDS_CONSULTATION' &&
    !body.contractType &&
    existing.status !== 'APPROVED'
  ) {
    throw new AppError(
      'Yêu cầu đang chờ tư vấn — chọn loại thuê (SHARED / RESERVED / ZONE / WAREHOUSE) khi duyệt',
      400,
      'VALIDATION_ERROR'
    );
  }

  const effectiveContractType = body.contractType ?? existing.contractType;
  if (effectiveContractType === 'DEDICATED_WAREHOUSE') {
    await assertWarehouseExclusiveForDedicatedLease(whId, existing.tenantId);
  }
  if (effectiveContractType === 'SHARED_STORAGE') {
    await assertWarehouseCanClaimSharedStorage(whId);
  }

  const row = await RentalRequest.queryOne(
    `UPDATE rental_requests
     SET warehouse_id = $1,
         status = 'APPROVED',
         reviewed_by = COALESCE($2, reviewed_by),
         reviewed_at = COALESCE($3, reviewed_at),
         review_note = COALESCE($4, review_note),
         rejection_reason = NULL,
         contract_type = COALESCE($5, contract_type),
         pricing_model = COALESCE($6, pricing_model),
         updated_at = NOW()
     WHERE rental_request_id = $7
       AND warehouse_id IS NULL
       AND status = ANY($8::rental_request_status_enum[])
       AND LOWER(TRIM(city)) = LOWER(TRIM($9))
       AND LOWER(TRIM(district)) = LOWER(TRIM($10))
     RETURNING *`,
    [
      whId,
      reviewedBy ?? null,
      reviewedAt,
      body.reviewNote ?? null,
      body.contractType ?? null,
      body.pricingModel ?? null,
      id,
      CLAIMABLE_STATUSES,
      warehouse.city,
      warehouse.district,
    ]
  );

  if (!row) {
    const current = await getRentalRequest(id);
    if (current.warehouseId) {
      throw new AppError(
        'Rental request already claimed by another warehouse',
        409,
        'ALREADY_CLAIMED'
      );
    }
    throw new AppError(
      'Cannot approve rental request (invalid status or region mismatch)',
      409,
      'CLAIM_FAILED'
    );
  }

  const approved = mapRentalRow(row);
  void notifyTenantAdminRentalApproved(approved);
  return approved;
}

export async function updateRentalRequest(rentalRequestId, body, actor = null) {
  const claimStatus = body.status === 'APPROVED';
  if (claimStatus && actor?.role !== 'WH_ADMIN') {
    throw new AppError(
      'Chỉ Warehouse Admin mới được duyệt rental request',
      403,
      'FORBIDDEN'
    );
  }
  if (claimStatus && body.warehouseId) {
    return claimRentalRequest(rentalRequestId, body.warehouseId, body);
  }

  if (claimStatus && !body.warehouseId) {
    throw new AppError(
      'warehouseId is required when approving a regional rental request',
      400,
      'VALIDATION_ERROR'
    );
  }

  const id = parseUuid(rentalRequestId, 'rentalRequestId');
  const existing = await getRentalRequest(id, actor);

  const isSystemAdminGuestNotify =
    actor?.role === 'SYSTEM_ADMIN' &&
    existing.warehouseId == null &&
    ['PENDING', 'UNDER_REVIEW'].includes(existing.status) &&
    body.reviewNote !== undefined &&
    String(body.reviewNote).trim().length > 0 &&
    (body.status === undefined || body.status === 'UNDER_REVIEW') &&
    body.warehouseId === undefined;

  if (
    existing.warehouseId == null &&
    body.status &&
    body.status !== 'REJECTED' &&
    !isSystemAdminGuestNotify
  ) {
    throw new AppError(
      'Unclaimed rental request can only be APPROVED (with warehouseId), REJECTED, or UNDER_REVIEW with reviewNote (System Admin)',
      400,
      'VALIDATION_ERROR'
    );
  }

  if (isSystemAdminGuestNotify) {
    body.status = 'UNDER_REVIEW';
    if (body.reviewedBy === undefined && actor?.userId) {
      body.reviewedBy = actor.userId;
    }
    if (body.reviewedAt === undefined) {
      body.reviewedAt = new Date().toISOString();
    }
  }

  const { productLines, selectedBoxTypeHint } = body;
  const hasProductLines = productLines !== undefined;
  const hasOtherUpdates = Object.keys(pickFields(body, UPDATE_FIELDS)).length > 0;

  if (hasProductLines) {
    if (!['PENDING', 'UNDER_REVIEW'].includes(existing.status)) {
      throw new AppError(
        'Cannot change productLines unless status is PENDING or UNDER_REVIEW',
        400,
        'VALIDATION_ERROR'
      );
    }
  }

  if (!hasProductLines && !hasOtherUpdates) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (hasOtherUpdates) {
      const data = normalizeUpdatePayload(body);
      await RentalRequest.updateById(id, data, client);
    }

    if (hasProductLines) {
      await replaceProductLinesForRentalRequest(
        id,
        productLines,
        { selectedBoxTypeHint },
        client
      );
    }

    await client.query('COMMIT');
    const item = await RentalRequest.findById(id);
    const enriched = await attachProductLinesToRentalRequest(item);
    if (body.status === 'REJECTED' && existing.status !== 'REJECTED') {
      void notifyTenantAdminRentalRejected(enriched);
    }
    return enriched;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
