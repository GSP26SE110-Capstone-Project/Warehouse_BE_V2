import * as batchService from '../services/batch.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { inboundRequestId } = req.query;

  const result = await batchService.listBatches({
    inboundRequestId,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const batch = await batchService.getBatch(req.params.batchId);
  success(res, batch);
}

export async function create(req, res) {
  const batch = await batchService.createBatch(req.body);
  created(res, batch);
}

export async function update(req, res) {
  const batch = await batchService.updateBatch(req.params.batchId, req.body);
  success(res, batch, 'Updated successfully');
}

export async function remove(req, res) {
  const batch = await batchService.deleteBatch(req.params.batchId);
  success(res, batch, 'Deleted successfully');
}
