import GarmentCategoryGroup from '../models/GarmentCategoryGroup.js';
import ProductKindCatalog from '../models/ProductKindCatalog.js';
import { CATALOG_STATUS, GARMENT_GROUP_CODE } from '../constants/productCatalog.js';
import AppError from '../utils/AppError.js';
import { assertEnum } from '../utils/validate.js';

function normalizeStatus(status) {
  if (status == null || status === '') return 'ACTIVE';
  assertEnum(status, CATALOG_STATUS, 'status');
  return status;
}

function normalizeGroupCode(groupCode) {
  if (groupCode == null || groupCode === '') return null;
  assertEnum(groupCode, GARMENT_GROUP_CODE, 'groupCode');
  return groupCode;
}

export async function listGarmentCategoryGroups({ status } = {}) {
  const filters = {};
  if (status) filters.status = normalizeStatus(status);

  const items = await GarmentCategoryGroup.findAll(filters, {
    orderBy: 'sort_order ASC, group_code ASC',
  });

  return items;
}

export async function listProductKinds({ groupCode, status } = {}) {
  const filters = {};
  const normalizedGroup = normalizeGroupCode(groupCode);
  if (normalizedGroup) filters.groupCode = normalizedGroup;
  if (status) filters.status = normalizeStatus(status);

  const items = await ProductKindCatalog.findAll(filters, {
    orderBy: 'sort_order ASC, display_name ASC',
  });

  return items;
}

export async function getProductKind(productKind) {
  const code = String(productKind ?? '').trim().toUpperCase();
  if (!code) {
    throw new AppError('productKind is required', 400, 'VALIDATION_ERROR');
  }

  const item = await ProductKindCatalog.findById(code);
  if (!item) {
    throw new AppError('Product kind not found', 404, 'NOT_FOUND');
  }

  return item;
}

export async function getProductKindCatalogTree({ status } = {}) {
  const normalizedStatus = status ? normalizeStatus(status) : 'ACTIVE';
  const groupFilters = { status: normalizedStatus };
  const kindFilters = { status: normalizedStatus };

  const [groups, productKinds] = await Promise.all([
    GarmentCategoryGroup.findAll(groupFilters, { orderBy: 'sort_order ASC, group_code ASC' }),
    ProductKindCatalog.findAll(kindFilters, { orderBy: 'sort_order ASC, display_name ASC' }),
  ]);

  const tree = groups.map((group) => ({
    ...group,
    productKinds: productKinds.filter((kind) => kind.groupCode === group.groupCode),
  }));

  return {
    groups,
    productKinds,
    tree,
  };
}
