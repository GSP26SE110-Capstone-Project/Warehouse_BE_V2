import * as rackLevelService from '../services/rackLevel.service.js';
import AppError from '../utils/AppError.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination, parseUuid } from '../utils/validate.js';

export async function list(req, res) {
  const rackId = req.query.rackId;
  if (!rackId) {
    throw new AppError('rackId query is required', 400, 'VALIDATION_ERROR');
  }

  const { page, limit, offset } = parsePagination(req.query);

  const result = await rackLevelService.listRackLevels(rackId, {
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const level = await rackLevelService.getRackLevel(req.params.rackLevelId);
  success(res, level);
}

export async function create(req, res) {
  const { rackId } = req.body;
  if (!rackId) {
    throw new AppError('rackId is required', 400, 'VALIDATION_ERROR');
  }
  parseUuid(rackId, 'rackId');

  const level = await rackLevelService.createRackLevel(rackId, req.body);
  created(res, level);
}

export async function update(req, res) {
  const level = await rackLevelService.updateRackLevel(req.params.rackLevelId, req.body);
  success(res, level, 'Updated successfully');
}

export async function remove(req, res) {
  const level = await rackLevelService.deleteRackLevel(req.params.rackLevelId);
  success(res, level, 'Deleted successfully');
}
