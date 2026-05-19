import * as contractService from '../services/contract.service.js';
import AppError from '../utils/AppError.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination, parseUuid } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { tenantId, warehouseId, rentalRequestId, status, contractType } = req.query;

  const result = await contractService.listContracts({
    tenantId,
    warehouseId,
    rentalRequestId,
    status,
    contractType,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const contract = await contractService.getContract(req.params.contractId);
  success(res, contract);
}

export async function create(req, res) {
  const { tenantId, warehouseId } = req.body;
  if (!tenantId) {
    throw new AppError('tenantId is required', 400, 'VALIDATION_ERROR');
  }
  if (!warehouseId) {
    throw new AppError('warehouseId is required', 400, 'VALIDATION_ERROR');
  }
  parseUuid(tenantId, 'tenantId');
  parseUuid(warehouseId, 'warehouseId');

  const contract = await contractService.createContract(tenantId, warehouseId, req.body);
  created(res, contract);
}

export async function update(req, res) {
  const contract = await contractService.updateContract(req.params.contractId, req.body);
  success(res, contract, 'Updated successfully');
}

export async function remove(req, res) {
  const contract = await contractService.deleteContract(req.params.contractId);
  success(res, contract, 'Deleted successfully');
}
