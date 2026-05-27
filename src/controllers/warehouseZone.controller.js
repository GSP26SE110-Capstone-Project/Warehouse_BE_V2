import * as zoneService from '../services/warehouseZone.service.js';
import * as warehouseService from '../services/warehouse.service.js';
import AppError from '../utils/AppError.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { assertWarehouseAccess } from '../utils/warehouseAccess.js';
import { parsePagination, parseUuid } from '../utils/validate.js';

export async function list(req, res) {
  const warehouseId = req.query.warehouseId;
  if (!warehouseId) {
    throw new AppError('warehouseId query is required', 400, 'VALIDATION_ERROR');
  }

  const { page, limit, offset } = parsePagination(req.query);
  const { status, zoneType } = req.query;

  const result = await zoneService.listZones(
    warehouseId,
    {
      status,
      zoneType,
      page,
      limit,
      offset,
    },
    req.user
  );

  paginated(res, result.items, result.meta);
}

export async function getPlanning(req, res) {
  const warehouseId = req.query.warehouseId;
  if (!warehouseId) {
    throw new AppError('warehouseId query is required', 400, 'VALIDATION_ERROR');
  }
  assertWarehouseAccess(req.user, warehouseId);
  const planning = await warehouseService.getWarehouseZonePlanning(warehouseId);
  success(res, planning);
}

export async function getById(req, res) {
  const zone = await zoneService.getZoneForUser(req.params.zoneId, req.user);
  success(res, zone);
}

export async function create(req, res) {
  const { warehouseId } = req.body;
  if (!warehouseId) {
    throw new AppError('warehouseId is required', 400, 'VALIDATION_ERROR');
  }
  parseUuid(warehouseId, 'warehouseId');

  const zone = await zoneService.createZone(warehouseId, req.body, req.user);
  created(res, zone);
}

export async function createBulk(req, res) {
  const { warehouseId } = req.body;
  if (!warehouseId) {
    throw new AppError('warehouseId is required', 400, 'VALIDATION_ERROR');
  }
  parseUuid(warehouseId, 'warehouseId');

  const result = await zoneService.createZonesBulk(warehouseId, req.body, req.user);
  created(res, result);
}

export async function update(req, res) {
  const zone = await zoneService.updateZone(req.params.zoneId, req.body, req.user);
  success(res, zone, 'Updated successfully');
}

export async function remove(req, res) {
  const zone = await zoneService.deleteZone(req.params.zoneId, req.user);
  success(res, zone, 'Deleted successfully');
}
