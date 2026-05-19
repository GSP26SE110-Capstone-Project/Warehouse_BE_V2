import * as binService from '../services/bin.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { status, reservationType, supportedBoxType } = req.query;

  const result = await binService.listBins(
    req.params.warehouseId,
    req.params.zoneId,
    req.params.rackId,
    req.params.rackLevelId,
    { status, reservationType, supportedBoxType, page, limit, offset }
  );

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const bin = await binService.getBinById(
    req.params.warehouseId,
    req.params.zoneId,
    req.params.rackId,
    req.params.rackLevelId,
    req.params.binId
  );
  success(res, bin);
}

export async function create(req, res) {
  const bin = await binService.createBin(
    req.params.warehouseId,
    req.params.zoneId,
    req.params.rackId,
    req.params.rackLevelId,
    req.body
  );
  created(res, bin);
}

export async function update(req, res) {
  const bin = await binService.updateBin(
    req.params.warehouseId,
    req.params.zoneId,
    req.params.rackId,
    req.params.rackLevelId,
    req.params.binId,
    req.body
  );
  success(res, bin, 'Updated successfully');
}

export async function remove(req, res) {
  const bin = await binService.deleteBin(
    req.params.warehouseId,
    req.params.zoneId,
    req.params.rackId,
    req.params.rackLevelId,
    req.params.binId
  );
  success(res, bin, 'Deleted successfully');
}
