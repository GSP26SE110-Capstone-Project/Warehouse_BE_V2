import * as rackService from '../services/rack.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { status, rackType } = req.query;

  const result = await rackService.listRacks(
    req.params.warehouseId,
    req.params.zoneId,
    { status, rackType, page, limit, offset }
  );

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const rack = await rackService.getRackById(
    req.params.warehouseId,
    req.params.zoneId,
    req.params.rackId
  );
  success(res, rack);
}

export async function create(req, res) {
  const rack = await rackService.createRack(
    req.params.warehouseId,
    req.params.zoneId,
    req.body
  );
  created(res, rack);
}

export async function update(req, res) {
  const rack = await rackService.updateRack(
    req.params.warehouseId,
    req.params.zoneId,
    req.params.rackId,
    req.body
  );
  success(res, rack, 'Updated successfully');
}

export async function remove(req, res) {
  const rack = await rackService.deleteRack(
    req.params.warehouseId,
    req.params.zoneId,
    req.params.rackId
  );
  success(res, rack, 'Deleted successfully');
}
