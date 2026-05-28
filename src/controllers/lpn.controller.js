import * as lpnService from '../services/lpn.service.js';
import * as lpnDetailService from '../services/lpnDetail.service.js';
import * as lpnRackSuggestionService from '../services/lpnRackSuggestion.service.js';
import * as inboundWorkflowService from '../services/inboundWorkflow.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { tenantId, batchId, status, boxType, currentBinId } = req.query;

  const result = await lpnService.listLpns({
    tenantId,
    batchId,
    status,
    boxType,
    currentBinId,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const lpn = await lpnService.getLpn(req.params.lpnId);
  success(res, lpn);
}

export async function getWithDetails(req, res) {
  const lpn = await lpnDetailService.getLpnWithDetails(req.params.lpnId);
  success(res, lpn);
}

export async function getRackSuggestion(req, res) {
  const suggestion = await lpnRackSuggestionService.suggestRackPlacementForLpn(
    req.params.lpnId,
    { warehouseId: req.query.warehouseId }
  );
  success(res, suggestion);
}

export async function create(req, res) {
  const lpn = await lpnService.createLpn(req.body);
  created(res, lpn);
}

export async function update(req, res) {
  const lpn = await lpnService.updateLpn(req.params.lpnId, req.body);
  success(res, lpn, 'Updated successfully');
}

export async function putaway(req, res) {
  const result = await inboundWorkflowService.putawayLpn(req.params.lpnId, req.body);
  success(res, result, 'Putaway completed');
}

export async function remove(req, res) {
  const lpn = await lpnService.deleteLpn(req.params.lpnId);
  success(res, lpn, 'Deleted successfully');
}
