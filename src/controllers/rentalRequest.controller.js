import * as rentalRequestService from '../services/rentalRequest.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { tenantId, warehouseId, regionMatch, city, district, status, contractType, pricingModel } =
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
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const item = await rentalRequestService.getRentalRequest(req.params.rentalRequestId);
  success(res, item);
}

export async function lookupByCode(req, res) {
  const item = await rentalRequestService.lookupRentalRequestByCode(
    req.query.code,
    req.query.email
  );
  success(res, item);
}

export async function create(req, res) {
  const item = await rentalRequestService.createRentalRequest(req.body);
  created(res, item);
}

export async function update(req, res) {
  const item = await rentalRequestService.updateRentalRequest(
    req.params.rentalRequestId,
    req.body
  );
  success(res, item, 'Updated successfully');
}

export async function remove(req, res) {
  const item = await rentalRequestService.deleteRentalRequest(req.params.rentalRequestId);
  success(res, item, 'Deleted successfully');
}
