import * as sizeFactorCatalogService from '../services/sizeFactorCatalog.service.js';
import { success } from '../utils/apiResponse.js';

export async function list(req, res) {
  const items = await sizeFactorCatalogService.listSizeFactors({
    status: req.query.status,
  });
  success(res, items);
}

export async function getByGroup(req, res) {
  const item = await sizeFactorCatalogService.getSizeFactor(req.params.sizeGroup);
  success(res, item);
}
