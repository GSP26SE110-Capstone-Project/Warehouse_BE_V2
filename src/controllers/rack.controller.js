import * as rackService from '../services/rack.service.js';
import AppError from '../utils/AppError.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination, parseUuid } from '../utils/validate.js';

export async function list(req, res) {
  const zoneId = req.query.zoneId;
  if (!zoneId) {
    throw new AppError('zoneId query is required', 400, 'VALIDATION_ERROR');
  }

  const { page, limit, offset } = parsePagination(req.query);
  const { status, rackType, includeBinStats } = req.query;

  const result = await rackService.listRacks(zoneId, {
    status,
    rackType,
    page,
    limit,
    offset,
    includeBinStats: includeBinStats === 'true' || includeBinStats === '1',
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const rack = await rackService.getRack(req.params.rackId);
  success(res, rack);
}

export async function create(req, res) {
  const { zoneId } = req.body;
  if (!zoneId) {
    throw new AppError('zoneId is required', 400, 'VALIDATION_ERROR');
  }
  parseUuid(zoneId, 'zoneId');

  const rack = await rackService.createRack(zoneId, req.body);
  created(res, rack);
}

export async function createBulk(req, res) {
  const { zoneId } = req.body;
  if (!zoneId) {
    throw new AppError('zoneId is required', 400, 'VALIDATION_ERROR');
  }
  parseUuid(zoneId, 'zoneId');

  const result = await rackService.createRacksBulk(zoneId, req.body);
  created(res, result);
}

export async function update(req, res) {
  const rack = await rackService.updateRack(req.params.rackId, req.body);
  success(res, rack, 'Updated successfully');
}

export async function remove(req, res) {
  const rack = await rackService.deleteRack(req.params.rackId);
  success(res, rack, 'Deleted successfully');
}
