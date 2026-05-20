import * as skuService from '../services/sku.service.js';
import AppError from '../utils/AppError.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { tenantId } = req.query;
  if (!tenantId) {
    throw new AppError('tenantId query is required', 400, 'VALIDATION_ERROR');
  }

  const { page, limit, offset } = parsePagination(req.query);
  const { status, movementCategory } = req.query;

  const result = await skuService.listSkus({
    tenantId,
    status,
    movementCategory,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const sku = await skuService.getSku(req.params.skuId);
  success(res, sku);
}

export async function create(req, res) {
  const sku = await skuService.createSku(req.body);
  created(res, sku);
}

export async function update(req, res) {
  const sku = await skuService.updateSku(req.params.skuId, req.body);
  success(res, sku, 'Updated successfully');
}

export async function remove(req, res) {
  const sku = await skuService.deleteSku(req.params.skuId);
  success(res, sku, 'Deleted successfully');
}
