import * as rentalRequestService from '../services/rentalRequest.service.js';
import AppError from '../utils/AppError.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination, parseUuid } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { warehouseId, status, contractType, pricingModel } = req.query;

  const result = await rentalRequestService.listRentalRequests({
    warehouseId,
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

export async function create(req, res) {
  const { warehouseId } = req.body;
  if (!warehouseId) {
    throw new AppError('warehouseId is required', 400, 'VALIDATION_ERROR');
  }
  parseUuid(warehouseId, 'warehouseId');

  const item = await rentalRequestService.createRentalRequest(warehouseId, req.body);
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
