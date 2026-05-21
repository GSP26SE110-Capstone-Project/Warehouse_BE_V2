import * as collectionService from '../services/collection.service.js';
import AppError from '../utils/AppError.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { tenantId } = req.query;
  if (!tenantId) {
    throw new AppError('tenantId query is required', 400, 'VALIDATION_ERROR');
  }

  const { page, limit, offset } = parsePagination(req.query);
  const result = await collectionService.listCollections({
    tenantId,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const collection = await collectionService.getCollection(req.params.collectionId);
  success(res, collection);
}

export async function create(req, res) {
  const collection = await collectionService.createCollection(req.body);
  created(res, collection);
}

export async function update(req, res) {
  const collection = await collectionService.updateCollection(
    req.params.collectionId,
    req.body
  );
  success(res, collection, 'Updated successfully');
}

export async function remove(req, res) {
  const collection = await collectionService.deleteCollection(req.params.collectionId);
  success(res, collection, 'Deleted successfully');
}
