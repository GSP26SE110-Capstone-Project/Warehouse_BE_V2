import * as inboundRequestItemService from '../services/inboundRequestItem.service.js';
import AppError from '../utils/AppError.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const inboundRequestId = req.params.inboundRequestId ?? req.query.inboundRequestId;

  if (!inboundRequestId) {
    throw new AppError('inboundRequestId query parameter is required', 400, 'VALIDATION_ERROR');
  }

  const result = await inboundRequestItemService.listInboundRequestItems(inboundRequestId, {
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const item = await inboundRequestItemService.getInboundRequestItemWithSku(
    req.params.inboundRequestItemId
  );
  success(res, item);
}

export async function create(req, res) {
  const item = await inboundRequestItemService.createInboundRequestItem(
    req.body,
    req.params.inboundRequestId
  );
  created(res, item);
}

export async function update(req, res) {
  const item = await inboundRequestItemService.updateInboundRequestItem(
    req.params.inboundRequestItemId,
    req.body
  );
  success(res, item, 'Updated successfully');
}

export async function remove(req, res) {
  const item = await inboundRequestItemService.deleteInboundRequestItem(
    req.params.inboundRequestItemId
  );
  success(res, item, 'Deleted successfully');
}
