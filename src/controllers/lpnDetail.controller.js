import * as lpnDetailService from '../services/lpnDetail.service.js';
import AppError from '../utils/AppError.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { lpnId } = req.query;
  if (!lpnId) {
    throw new AppError('lpnId query is required', 400, 'VALIDATION_ERROR');
  }

  const { page, limit, offset } = parsePagination(req.query);
  const result = await lpnDetailService.listLpnDetails(lpnId, { page, limit, offset });
  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const detail = await lpnDetailService.getLpnDetailWithSku(req.params.lpnDetailId);
  success(res, detail);
}

export async function create(req, res) {
  const detail = await lpnDetailService.createLpnDetail(req.body);
  created(res, detail);
}

export async function update(req, res) {
  const detail = await lpnDetailService.updateLpnDetail(req.params.lpnDetailId, req.body);
  success(res, detail, 'Updated successfully');
}

export async function remove(req, res) {
  const detail = await lpnDetailService.deleteLpnDetail(req.params.lpnDetailId);
  success(res, detail, 'Deleted successfully');
}
