import * as warehouseService from '../services/warehouse.service.js';
import * as rentalRequestService from '../services/rentalRequest.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { status } = req.query;

  const result = await warehouseService.listWarehouses({
    status,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const warehouse = await warehouseService.getWarehouseById(req.params.warehouseId);
  success(res, warehouse);
}

export async function listRentalRequests(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { status, contractType, pricingModel } = req.query;

  const result = await rentalRequestService.listRentalRequests({
    warehouseId: req.params.warehouseId,
    status,
    contractType,
    pricingModel,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function create(req, res) {
  const warehouse = await warehouseService.createWarehouse(req.body);
  created(res, warehouse);
}

export async function update(req, res) {
  const warehouse = await warehouseService.updateWarehouse(
    req.params.warehouseId,
    req.body
  );
  success(res, warehouse, 'Updated successfully');
}

export async function remove(req, res) {
  const warehouse = await warehouseService.deleteWarehouse(req.params.warehouseId);
  success(res, warehouse, 'Deleted successfully');
}
