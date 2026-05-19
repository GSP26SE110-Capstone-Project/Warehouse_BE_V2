import * as reservationService from '../services/storageReservation.service.js';
import AppError from '../utils/AppError.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination, parseUuid } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const {
    contractId,
    tenantId,
    warehouseId,
    zoneId,
    rackId,
    rackLevelId,
    binId,
    storageLevel,
    status,
  } = req.query;

  const result = await reservationService.listStorageReservations({
    contractId,
    tenantId,
    warehouseId,
    zoneId,
    rackId,
    rackLevelId,
    binId,
    storageLevel,
    status,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const reservation = await reservationService.getStorageReservation(
    req.params.reservationId
  );
  success(res, reservation);
}

export async function create(req, res) {
  const { contractId } = req.body;
  if (!contractId) {
    throw new AppError('contractId is required', 400, 'VALIDATION_ERROR');
  }
  parseUuid(contractId, 'contractId');

  const reservation = await reservationService.createStorageReservation(
    contractId,
    req.body
  );
  created(res, reservation);
}

export async function update(req, res) {
  const reservation = await reservationService.updateStorageReservation(
    req.params.reservationId,
    req.body
  );
  success(res, reservation, 'Updated successfully');
}

export async function remove(req, res) {
  const reservation = await reservationService.deleteStorageReservation(
    req.params.reservationId
  );
  success(res, reservation, 'Deleted successfully');
}
