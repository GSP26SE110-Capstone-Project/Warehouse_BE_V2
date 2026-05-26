import * as inventoryService from '../services/inventory.service.js';
import { paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { tenantId, skuId, batchId, lpnId, binId, status } = req.query;

  const result = await inventoryService.listInventories({
    tenantId,
    skuId,
    batchId,
    lpnId,
    binId,
    status,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const inventory = await inventoryService.getInventoryWithContext(req.params.inventoryId);
  success(res, inventory);
}

export async function listMovements(req, res) {
  const { page, limit, offset } = parsePagination(req.query);

  const result = await inventoryService.listInventoryMovements(req.params.inventoryId, {
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}
