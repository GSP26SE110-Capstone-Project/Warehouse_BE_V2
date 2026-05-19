import * as contractItemService from '../services/contractItem.service.js';
import AppError from '../utils/AppError.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination, parseUuid } from '../utils/validate.js';

export async function list(req, res) {
  const contractId = req.query.contractId;
  if (!contractId) {
    throw new AppError('contractId query is required', 400, 'VALIDATION_ERROR');
  }

  const { page, limit, offset } = parsePagination(req.query);

  const result = await contractItemService.listContractItems(contractId, {
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const item = await contractItemService.getContractItem(req.params.contractItemId);
  success(res, item);
}

export async function create(req, res) {
  const { contractId } = req.body;
  if (!contractId) {
    throw new AppError('contractId is required', 400, 'VALIDATION_ERROR');
  }
  parseUuid(contractId, 'contractId');

  const item = await contractItemService.createContractItem(contractId, req.body);
  created(res, item);
}

export async function update(req, res) {
  const item = await contractItemService.updateContractItem(
    req.params.contractItemId,
    req.body
  );
  success(res, item, 'Updated successfully');
}

export async function remove(req, res) {
  const item = await contractItemService.deleteContractItem(req.params.contractItemId);
  success(res, item, 'Deleted successfully');
}
