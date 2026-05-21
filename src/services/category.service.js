import Category from '../models/Category.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';

const CREATE_FIELDS = ['categoryName'];
const UPDATE_FIELDS = ['categoryName'];

function pickFields(source, fields) {
  const result = {};
  for (const field of fields) {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
  }
  return result;
}

function normalizeName(value, fieldName) {
  const name = String(value ?? '').trim();
  if (!name) {
    throw new AppError(`${fieldName} is required`, 400, 'VALIDATION_ERROR');
  }
  return name;
}

async function findByName(categoryName, excludeId = null) {
  const rows = await Category.findAll({});
  const normalized = categoryName.trim().toLowerCase();
  return rows.find(
    (row) =>
      row.categoryName?.trim().toLowerCase() === normalized &&
      row.categoryId !== excludeId
  );
}

function normalizeCreatePayload(body) {
  const data = pickFields(body, CREATE_FIELDS);
  data.categoryName = normalizeName(data.categoryName, 'categoryName');
  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.categoryName != null) {
    data.categoryName = normalizeName(data.categoryName, 'categoryName');
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

export async function getCategory(categoryId) {
  const id = parseUuid(categoryId, 'categoryId');
  const category = await Category.findById(id);
  if (!category) {
    throw new AppError('Category not found', 404, 'NOT_FOUND');
  }
  return category;
}

export async function listCategories({ page, limit, offset }) {
  const [items, total] = await Promise.all([
    Category.findAll({}, { orderBy: 'category_name ASC', limit, offset }),
    Category.count({}),
  ]);

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}

export async function createCategory(body) {
  const data = normalizeCreatePayload(body);
  const duplicate = await findByName(data.categoryName);
  if (duplicate) {
    throw new AppError('Category name already exists', 409, 'DUPLICATE');
  }
  return Category.create(data);
}

export async function updateCategory(categoryId, body) {
  const id = parseUuid(categoryId, 'categoryId');
  await getCategory(id);

  const data = normalizeUpdatePayload(body);
  if (data.categoryName) {
    const duplicate = await findByName(data.categoryName, id);
    if (duplicate) {
      throw new AppError('Category name already exists', 409, 'DUPLICATE');
    }
  }

  return Category.updateById(id, data);
}

export async function deleteCategory(categoryId) {
  const id = parseUuid(categoryId, 'categoryId');
  await getCategory(id);

  const deleted = await Category.deleteById(id);
  if (!deleted) {
    throw new AppError('Category not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
