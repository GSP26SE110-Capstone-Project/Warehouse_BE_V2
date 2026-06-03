import * as outboundRequestService from '../services/outboundRequest.service.js';
import * as outboundRequestItemService from '../services/outboundRequestItem.service.js';
import * as outboundWorkflowService from '../services/outboundWorkflow.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { tenantId, warehouseId, contractId, status } = req.query;

  const result = await outboundRequestService.listOutboundRequests({
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
  const includeItems =
    req.query.includeItems === 'true' || req.query.includeItems === '1';

  const outbound = includeItems
    ? await outboundRequestItemService.getOutboundRequestWithItems(
        req.params.outboundRequestId
      )
    : await outboundRequestService.getOutboundRequest(req.params.outboundRequestId);

  success(res, outbound);
}

export async function create(req, res) {
  const outbound = await outboundRequestService.createOutboundRequest(
    req.body,
    req.user
  );
  created(res, outbound);
}

export async function update(req, res) {
  const outbound = await outboundRequestService.updateOutboundRequest(
    req.params.outboundRequestId,
    req.body,
    req.user
  );
  success(res, outbound, 'Updated successfully');
}

export async function listPickingTasks(req, res) {
  const tasks = await outboundWorkflowService.listPickingTasksForOutbound(
    req.params.outboundRequestId
  );
  success(res, tasks);
}

export async function remove(req, res) {
  const outbound = await outboundRequestService.deleteOutboundRequest(
    req.params.outboundRequestId
  );
  success(res, outbound, 'Deleted successfully');
}
