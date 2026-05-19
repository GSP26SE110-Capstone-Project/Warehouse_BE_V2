import * as zoneService from '../services/warehouseZone.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { status, zoneType } = req.query;

  const result = await zoneService.listZones(req.params.warehouseId, {
    status,
    zoneType,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const zone = await zoneService.getZoneById(
    req.params.warehouseId,
    req.params.zoneId
  );
  success(res, zone);
}

export async function create(req, res) {
  const zone = await zoneService.createZone(req.params.warehouseId, req.body);
  created(res, zone);
}

export async function update(req, res) {
  const zone = await zoneService.updateZone(
    req.params.warehouseId,
    req.params.zoneId,
    req.body
  );
  success(res, zone, 'Updated successfully');
}

export async function remove(req, res) {
  const zone = await zoneService.deleteZone(
    req.params.warehouseId,
    req.params.zoneId
  );
  success(res, zone, 'Deleted successfully');
}
