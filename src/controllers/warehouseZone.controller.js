import * as zoneService from '../services/warehouseZone.service.js';
import AppError from '../utils/AppError.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination, parseUuid } from '../utils/validate.js';

export async function list(req, res) {
  const warehouseId = req.query.warehouseId;
  if (!warehouseId) {
    throw new AppError('warehouseId query is required', 400, 'VALIDATION_ERROR');
  }

  const { page, limit, offset } = parsePagination(req.query);
  const { status, zoneType } = req.query;

  const result = await zoneService.listZones(warehouseId, {
    status,
    zoneType,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const zone = await zoneService.getZone(req.params.zoneId);
  success(res, zone);
}

export async function create(req, res) {
  const { warehouseId } = req.body;
  if (!warehouseId) {
    throw new AppError('warehouseId is required', 400, 'VALIDATION_ERROR');
  }
  parseUuid(warehouseId, 'warehouseId');

  const zone = await zoneService.createZone(warehouseId, req.body);
  created(res, zone);
}

export async function update(req, res) {
  const zone = await zoneService.updateZone(req.params.zoneId, req.body);
  success(res, zone, 'Updated successfully');
}

export async function remove(req, res) {
  const zone = await zoneService.deleteZone(req.params.zoneId);
  success(res, zone, 'Deleted successfully');
}
