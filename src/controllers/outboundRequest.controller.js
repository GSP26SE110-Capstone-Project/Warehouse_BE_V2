import * as outboundRequestService from '../services/outboundRequest.service.js';
import * as outboundRequestItemService from '../services/outboundRequestItem.service.js';
import * as outboundWorkflowService from '../services/outboundWorkflow.service.js';
import * as outboundDeliveryService from '../services/outboundDelivery.service.js';
import { getOperationalInvoiceForSource } from '../services/operationalInvoice.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';
import AppError from '../utils/AppError.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { tenantId, warehouseId, contractId, status, assignedPickerMe, assignedToMe } =
    req.query;

  let assignedPickerUserId;
  if (assignedPickerMe === 'true' || assignedPickerMe === '1') {
    if (req.user?.role !== 'WH_STAFF') {
      throw new AppError('assignedPickerMe requires WH_STAFF', 403, 'FORBIDDEN');
    }
    assignedPickerUserId = req.user.userId;
  }

  let assignedDriverUserId;
  if (assignedToMe === 'true' || assignedToMe === '1') {
    if (req.user?.role !== 'WH_TRANSPORTER') {
      throw new AppError('assignedToMe requires WH_TRANSPORTER', 403, 'FORBIDDEN');
    }
    assignedDriverUserId = req.user.userId;
  }

  const result = await outboundRequestService.listOutboundRequests({
    tenantId,
    warehouseId,
    contractId,
    status,
    assignedPickerUserId,
    assignedDriverUserId,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const includeItems =
    req.query.includeItems === 'true' || req.query.includeItems === '1';
  const includeDelivery =
    req.query.includeDelivery === 'true' || req.query.includeDelivery === '1';

  let outbound = includeItems
    ? await outboundRequestItemService.getOutboundRequestWithItems(
        req.params.outboundRequestId
      )
    : await outboundRequestService.getOutboundRequest(req.params.outboundRequestId);

  if (includeDelivery) {
    const delivery = await outboundDeliveryService.getOutboundDeliveryByRequestId(
      req.params.outboundRequestId
    );
    outbound = { ...outbound, delivery };
  }

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

export async function previewFifoAllocation(req, res) {
  const preview = await outboundWorkflowService.previewFifoAllocationForOutbound(
    req.params.outboundRequestId,
    req.user
  );
  success(res, preview, 'FIFO allocation preview');
}

export async function listPickingTasks(req, res) {
  const tasks = await outboundWorkflowService.listPickingTasksForOutbound(
    req.params.outboundRequestId
  );
  success(res, tasks);
}

export async function assignPicker(req, res) {
  const tasks = await outboundWorkflowService.assignPickingTaskPicker(
    req.params.outboundRequestId,
    req.user,
    req.body.assignedPickerUserId
  );
  success(res, tasks, 'Picker assigned successfully');
}

export async function getOperationalInvoice(req, res) {
  const invoice = await getOperationalInvoiceForSource(
    'OUTBOUND_REQUEST',
    req.params.outboundRequestId
  );
  success(res, invoice);
}

export async function remove(req, res) {
  const outbound = await outboundRequestService.deleteOutboundRequest(
    req.params.outboundRequestId
  );
  success(res, outbound, 'Deleted successfully');
}
