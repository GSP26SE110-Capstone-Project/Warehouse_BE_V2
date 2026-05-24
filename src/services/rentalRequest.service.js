import RentalRequest from '../models/RentalRequest.js';
import AppError from '../utils/AppError.js';
import { assertEnum, parseUuid } from '../utils/validate.js';
import { locationMatches, requireLocationField } from '../utils/location.js';
import { resolveCityDistrict } from './location.service.js';
import { ZONE_TYPE, RACK_TYPE } from '../constants/warehouseStructure.js';
import {
  BILLING_CYCLE,
  CONTRACT_TYPE,
  PRICING_MODEL,
  RENTAL_REQUEST_STATUS,
} from '../constants/tenantOnboarding.js';
import { getWarehouseById } from './warehouse.service.js';
import { getTenantCompany } from './tenantCompany.service.js';
import { fromDbRecord } from '../models/utils/fieldMapper.js';
import { rentalRequestSchema } from '../models/RentalRequest.js';

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
  'createdBy',
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

function normalizeCreatePayload(body) {
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

  normalizeNumericFields(data);
  validateEnums(data);

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

export async function getRentalRequest(rentalRequestId) {
  const id = parseUuid(rentalRequestId, 'rentalRequestId');
  const item = await RentalRequest.findById(id);
  if (!item) {
    throw new AppError('Rental request not found', 404, 'NOT_FOUND');
  }
  return item;
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

  let warehouseName = null;
  if (item.warehouseId) {
    const warehouse = await getWarehouseById(item.warehouseId);
    warehouseName = warehouse.warehouseName ?? null;
  }

  return {
    requestCode: item.requestCode,
    status: item.status,
    companyName: tenant.companyName,
    city: item.city,
    district: item.district,
    contractType: item.contractType ?? null,
    pricingModel: item.pricingModel ?? null,
    billingCycle: item.billingCycle ?? null,
    estimatedBoxCount: item.estimatedBoxCount ?? null,
    estimatedSkuCount: item.estimatedSkuCount ?? null,
    estimatedInboundPerWeek: item.estimatedInboundPerWeek ?? null,
    estimatedOutboundPerWeek: item.estimatedOutboundPerWeek ?? null,
    requestedAreaM2: item.requestedAreaM2 ?? null,
    requiresFastPicking: item.requiresFastPicking ?? false,
    requiresPremiumStorage: item.requiresPremiumStorage ?? false,
    expectedStartDate: item.expectedStartDate ?? null,
    expectedEndDate: item.expectedEndDate ?? null,
    rejectionReason: item.rejectionReason ?? null,
    warehouseName,
    createdAt: item.createdAt ?? null,
    updatedAt: item.updatedAt ?? null,
    reviewedAt: item.reviewedAt ?? null,
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
  page,
  limit,
  offset,
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

  if (status) filters.status = status;
  if (contractType) filters.contractType = contractType;
  if (pricingModel) filters.pricingModel = pricingModel;

  const { conditions, params } = buildListConditions(filters, { regionMatchWarehouse });
  const { items, total } = await queryRentalRequests({ conditions, params, limit, offset });

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

export async function createRentalRequest(body) {
  const data = normalizeCreatePayload(body);
  await assertKnownCityDistrict(data);
  await getTenantCompany(data.tenantId);
  return RentalRequest.create(data);
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

  const row = await RentalRequest.queryOne(
    `UPDATE rental_requests
     SET warehouse_id = $1,
         status = 'APPROVED',
         reviewed_by = COALESCE($2, reviewed_by),
         reviewed_at = COALESCE($3, reviewed_at),
         review_note = COALESCE($4, review_note),
         rejection_reason = NULL,
         updated_at = NOW()
     WHERE rental_request_id = $5
       AND warehouse_id IS NULL
       AND status = ANY($6::text[])
       AND LOWER(TRIM(city)) = LOWER(TRIM($7))
       AND LOWER(TRIM(district)) = LOWER(TRIM($8))
     RETURNING *`,
    [
      whId,
      reviewedBy ?? null,
      reviewedAt,
      body.reviewNote ?? null,
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

  return mapRentalRow(row);
}

export async function updateRentalRequest(rentalRequestId, body) {
  const claimStatus = body.status === 'APPROVED';
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
  const existing = await getRentalRequest(id);

  if (existing.warehouseId == null && body.status && body.status !== 'REJECTED') {
    throw new AppError(
      'Unclaimed rental request can only be APPROVED (with warehouseId) or REJECTED',
      400,
      'VALIDATION_ERROR'
    );
  }

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
