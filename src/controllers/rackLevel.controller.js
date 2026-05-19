import * as rackLevelService from '../services/rackLevel.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);

  const result = await rackLevelService.listRackLevels(
    req.params.warehouseId,
    req.params.zoneId,
    req.params.rackId,
    { page, limit, offset }
  );

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const level = await rackLevelService.getRackLevelById(
    req.params.warehouseId,
    req.params.zoneId,
    req.params.rackId,
    req.params.rackLevelId
  );
  success(res, level);
}

export async function create(req, res) {
  const level = await rackLevelService.createRackLevel(
    req.params.warehouseId,
    req.params.zoneId,
    req.params.rackId,
    req.body
  );
  created(res, level);
}

export async function update(req, res) {
  const level = await rackLevelService.updateRackLevel(
    req.params.warehouseId,
    req.params.zoneId,
    req.params.rackId,
    req.params.rackLevelId,
    req.body
  );
  success(res, level, 'Updated successfully');
}

export async function remove(req, res) {
  const level = await rackLevelService.deleteRackLevel(
    req.params.warehouseId,
    req.params.zoneId,
    req.params.rackId,
    req.params.rackLevelId
  );
  success(res, level, 'Deleted successfully');
}
