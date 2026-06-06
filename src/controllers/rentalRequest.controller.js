import * as rentalRequestService from '../services/rentalRequest.service.js';
import * as contractPriceEstimateService from '../services/contractPriceEstimate.service.js';
import AppError from '../utils/AppError.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { tenantId, warehouseId, regionMatch, city, district, status, contractType, pricingModel, includeProductLines } =
    req.query;

  const result = await rentalRequestService.listRentalRequests({
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
    user: req.user,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const { rentalRequestId } = req.params;
  if (rentalRequestId === 'lookup' || rentalRequestId === 'guest') {
    throw new AppError('Rental request not found', 404, 'NOT_FOUND');
  }
  const item = await rentalRequestService.getRentalRequest(rentalRequestId, req.user);
  success(res, item);
}

function parseZoneIdsQuery(query) {
  const raw = query.zoneIds;
  if (raw == null || raw === '') return undefined;
  const parts = Array.isArray(raw) ? raw : String(raw).split(',');
  return parts.map((s) => String(s).trim()).filter(Boolean);
}

export async function getPriceEstimate(req, res) {
  const { rentalRequestId } = req.params;
  const { warehouseId, contractType, startDate, endDate } = req.query;
  const zoneIds = parseZoneIdsQuery(req.query);
  const estimate = await contractPriceEstimateService.estimateContractPrice(
    rentalRequestId,
    warehouseId,
    req.user,
    { zoneIds, contractType, startDate, endDate }
  );
  success(res, estimate);
}

export async function lookupByCode(req, res) {
  const item = await rentalRequestService.lookupRentalRequestByCode(
    req.query.code,
    req.query.email
  );
  success(res, item);
}

export async function create(req, res) {
  const item = await rentalRequestService.createRentalRequest(req.body, req.user ?? null);
  created(res, item);
}

export async function update(req, res) {
  const item = await rentalRequestService.updateRentalRequest(
    req.params.rentalRequestId,
    req.body,
    req.user
  );
  success(res, item, 'Updated successfully');
}

export async function remove(req, res) {
  const item = await rentalRequestService.deleteRentalRequest(req.params.rentalRequestId);
  success(res, item, 'Deleted successfully');
}
