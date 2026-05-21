import * as categoryService from '../services/category.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const result = await categoryService.listCategories({ page, limit, offset });
  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const category = await categoryService.getCategory(req.params.categoryId);
  success(res, category);
}

export async function create(req, res) {
  const category = await categoryService.createCategory(req.body);
  created(res, category);
}

export async function update(req, res) {
  const category = await categoryService.updateCategory(req.params.categoryId, req.body);
  success(res, category, 'Updated successfully');
}

export async function remove(req, res) {
  const category = await categoryService.deleteCategory(req.params.categoryId);
  success(res, category, 'Deleted successfully');
}
