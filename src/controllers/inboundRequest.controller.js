import * as inboundRequestService from '../services/inboundRequest.service.js';
import * as inboundRequestItemService from '../services/inboundRequestItem.service.js';
import * as inboundWorkflowService from '../services/inboundWorkflow.service.js';
import * as inboundApprovalReadinessService from '../services/inboundApprovalReadiness.service.js';
import * as inboundDeliveryService from '../services/inboundDelivery.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';
import { applyInboundListScope, assertInboundReadable } from '../utils/inboundAccess.js';
import AppError from '../utils/AppError.js';
import { WH_TRANSPORT_ROLES } from '../constants/auth.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { tenantId, warehouseId, contractId, status, deliveryMode, assignedToMe } =
    req.query;

  let assignedDriverUserId = req.query.assignedDriverUserId;
  if (assignedToMe === 'true' || assignedToMe === '1') {
    if (!req.user || !WH_TRANSPORT_ROLES.includes(req.user.role)) {
      throw new AppError('assignedToMe requires WH_TRANSPORTER', 403, 'FORBIDDEN');
    }
    assignedDriverUserId = req.user.userId;
  }

  const scoped = applyInboundListScope(req.user, {
    tenantId,
    warehouseId,
    contractId,
    status,
    deliveryMode,
    assignedDriverUserId,
    includeDelivery:
      req.query.includeDelivery === 'true' || req.query.includeDelivery === '1',
    page,
    limit,
    offset,
  });

  const result = await inboundRequestService.listInboundRequests(scoped);

  paginated(res, result.items, result.meta);
}

export async function getApprovalReadiness(req, res) {
  const readiness = await inboundApprovalReadinessService.getInboundApprovalReadiness(
    req.params.inboundRequestId
  );
  success(res, readiness);
}

export async function getById(req, res) {
  await assertInboundReadable(req.params.inboundRequestId, req.user);

  const includeItems =
    req.query.includeItems === 'true' || req.query.includeItems === '1';
  const includeDelivery =
    req.query.includeDelivery === 'true' || req.query.includeDelivery === '1';

  let inbound = includeItems
    ? await inboundRequestItemService.getInboundRequestWithItems(req.params.inboundRequestId)
    : await inboundRequestService.getInboundRequest(req.params.inboundRequestId);

  if (includeDelivery) {
    const delivery = await inboundDeliveryService.getInboundDeliveryByRequestId(
      req.params.inboundRequestId
    );
    inbound = { ...inbound, delivery };
  }

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

export async function startReceiving(req, res) {
  const inbound = await inboundWorkflowService.startReceiving(
    req.params.inboundRequestId,
    req.body
  );
  success(res, inbound, 'Receiving started');
}

export async function completeReceiving(req, res) {
  const result = await inboundWorkflowService.completeReceiving(
    req.params.inboundRequestId,
    req.body
  );
  success(res, result, result.message);
}

export async function complete(req, res) {
  const inbound = await inboundWorkflowService.completeInbound(
    req.params.inboundRequestId,
    req.body
  );
  success(res, inbound, 'Inbound completed');
}

export async function bulkPutaway(req, res) {
  const result = await inboundWorkflowService.bulkPutawayInbound(
    req.params.inboundRequestId,
    req.body
  );
  success(res, result, `Putaway ${result.putawayCount} LPN`);
}

export async function autoPutaway(req, res) {
  const result = await inboundWorkflowService.autoPutawayInbound(
    req.params.inboundRequestId,
    req.body
  );
  success(res, result, `Putaway tự động ${result.putawayCount} LPN`);
}

export async function reportArrival(req, res) {
  const inbound = await inboundDeliveryService.reportInboundArrival(
    req.params.inboundRequestId,
    req.user
  );
  success(res, inbound, 'Arrival reported');
}
