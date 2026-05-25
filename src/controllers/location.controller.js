import * as locationService from '../services/location.service.js';
import AppError from '../utils/AppError.js';
import { success } from '../utils/apiResponse.js';

export async function listTree(req, res) {
  const tree = await locationService.listLocationTree();
  success(res, tree);
}

export async function listWarehousesInRegion(req, res) {
  const city = String(req.query.city ?? '').trim();
  const district = String(req.query.district ?? '').trim();
  if (!city || !district) {
    throw new AppError('city and district query params are required', 400, 'VALIDATION_ERROR');
  }
  const data = await locationService.listWarehousesInRegion(city, district);
  success(res, data);
}
