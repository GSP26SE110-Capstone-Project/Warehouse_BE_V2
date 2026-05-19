import * as binService from '../services/bin.service.js';
import AppError from '../utils/AppError.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination, parseUuid } from '../utils/validate.js';

export async function list(req, res) {
  const rackLevelId = req.query.rackLevelId;
  if (!rackLevelId) {
    throw new AppError('rackLevelId query is required', 400, 'VALIDATION_ERROR');
  }

  const { page, limit, offset } = parsePagination(req.query);
  const { status, reservationType, supportedBoxType } = req.query;

  const result = await binService.listBins(rackLevelId, {
    status,
    reservationType,
    supportedBoxType,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const bin = await binService.getBin(req.params.binId);
  success(res, bin);
}

export async function create(req, res) {
  const { rackLevelId } = req.body;
  if (!rackLevelId) {
    throw new AppError('rackLevelId is required', 400, 'VALIDATION_ERROR');
  }
  parseUuid(rackLevelId, 'rackLevelId');

  const bin = await binService.createBin(rackLevelId, req.body);
  created(res, bin);
}

export async function update(req, res) {
  const bin = await binService.updateBin(req.params.binId, req.body);
  success(res, bin, 'Updated successfully');
}

export async function remove(req, res) {
  const bin = await binService.deleteBin(req.params.binId);
  success(res, bin, 'Deleted successfully');
}
