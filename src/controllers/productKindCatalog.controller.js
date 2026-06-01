import * as productKindCatalogService from '../services/productKindCatalog.service.js';
import { success } from '../utils/apiResponse.js';

export async function listGroups(req, res) {
  const items = await productKindCatalogService.listGarmentCategoryGroups({
    status: req.query.status,
  });
  success(res, items);
}

export async function list(req, res) {
  const items = await productKindCatalogService.listProductKinds({
    groupCode: req.query.groupCode,
    status: req.query.status,
  });
  success(res, items);
}

export async function getTree(req, res) {
  const catalog = await productKindCatalogService.getProductKindCatalogTree({
    status: req.query.status,
  });
  success(res, catalog);
}

export async function getByCode(req, res) {
  const item = await productKindCatalogService.getProductKind(req.params.productKind);
  success(res, item);
}
