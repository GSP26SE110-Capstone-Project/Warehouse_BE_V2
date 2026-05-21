import * as inboundRequestService from '../services/inboundRequest.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { tenantId, warehouseId, contractId, status } = req.query;

  const result = await inboundRequestService.listInboundRequests({
    tenantId,
    warehouseId,
    contractId,
    status,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const inbound = await inboundRequestService.getInboundRequest(req.params.inboundRequestId);
  success(res, inbound);
}

export async function create(req, res) {
  const inbound = await inboundRequestService.createInboundRequest(req.body);
  created(res, inbound);
}

export async function update(req, res) {
  const inbound = await inboundRequestService.updateInboundRequest(
    req.params.inboundRequestId,
    req.body
  );
  success(res, inbound, 'Updated successfully');
}

export async function remove(req, res) {
  const inbound = await inboundRequestService.deleteInboundRequest(req.params.inboundRequestId);
  success(res, inbound, 'Deleted successfully');
}
