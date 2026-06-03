import * as outboundRequestItemService from '../services/outboundRequestItem.service.js';
import AppError from '../utils/AppError.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const outboundRequestId = req.params.outboundRequestId ?? req.query.outboundRequestId;

  if (!outboundRequestId) {
    throw new AppError('outboundRequestId query parameter is required', 400, 'VALIDATION_ERROR');
  }

  const result = await outboundRequestItemService.listOutboundRequestItems(outboundRequestId, {
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const item = await outboundRequestItemService.getOutboundRequestItemWithSku(
    req.params.outboundRequestItemId
  );
  success(res, item);
}

export async function create(req, res) {
  const item = await outboundRequestItemService.createOutboundRequestItem(
    req.body,
    req.params.outboundRequestId
  );
  created(res, item);
}

export async function update(req, res) {
  const item = await outboundRequestItemService.updateOutboundRequestItem(
    req.params.outboundRequestItemId,
    req.body
  );
  success(res, item, 'Updated successfully');
}

export async function remove(req, res) {
  const item = await outboundRequestItemService.deleteOutboundRequestItem(
    req.params.outboundRequestItemId
  );
  success(res, item, 'Deleted successfully');
}
