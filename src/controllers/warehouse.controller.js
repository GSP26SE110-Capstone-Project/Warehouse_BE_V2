import * as warehouseService from '../services/warehouse.service.js';
import * as rentalRequestService from '../services/rentalRequest.service.js';
import * as inboundRequestService from '../services/inboundRequest.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import {
  assertTenantWarehouseAccess,
  assertWarehouseAccess,
  getScopedTenantId,
  getScopedWarehouseId,
} from '../utils/warehouseAccess.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { status } = req.query;

  const result = await warehouseService.listWarehouses({
    status,
    page,
    limit,
    offset,
    scopedWarehouseId: getScopedWarehouseId(req.user),
    scopedTenantId: getScopedTenantId(req.user),
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  assertWarehouseAccess(req.user, req.params.warehouseId);
  await assertTenantWarehouseAccess(req.user, req.params.warehouseId);
  const warehouse = await warehouseService.getWarehouseById(req.params.warehouseId);
  success(res, warehouse);
}

export async function getZonePlanning(req, res) {
  assertWarehouseAccess(req.user, req.params.warehouseId);
  await assertTenantWarehouseAccess(req.user, req.params.warehouseId);
  const planning = await warehouseService.getWarehouseZonePlanning(req.params.warehouseId);
  success(res, planning);
}

export async function listRentalRequests(req, res) {
  assertWarehouseAccess(req.user, req.params.warehouseId);
  const { page, limit, offset } = parsePagination(req.query);
  const { tenantId, regionMatch, status, contractType, pricingModel } = req.query;

  const result = await rentalRequestService.listRentalRequests({
    warehouseId: req.params.warehouseId,
    regionMatch: regionMatch ?? 'true',
    tenantId,
    status,
    contractType,
    pricingModel,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function listInboundRequests(req, res) {
  assertWarehouseAccess(req.user, req.params.warehouseId);
  const { page, limit, offset } = parsePagination(req.query);
  const { tenantId, contractId, status } = req.query;

  const result = await inboundRequestService.listInboundRequests({
    warehouseId: req.params.warehouseId,
    tenantId,
    contractId,
    status,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function create(req, res) {
  const warehouse = await warehouseService.createWarehouse(req.body, req.user);
  created(res, warehouse);
}

export async function update(req, res) {
  const warehouse = await warehouseService.updateWarehouse(
    req.params.warehouseId,
    req.body,
    req.user
  );
  success(res, warehouse, 'Updated successfully');
}

export async function remove(req, res) {
  const warehouse = await warehouseService.deleteWarehouse(req.params.warehouseId, req.user);
  success(res, warehouse, 'Deleted successfully');
}
