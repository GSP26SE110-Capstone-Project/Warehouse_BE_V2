import * as seasonService from '../services/season.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const result = await seasonService.listSeasons({ page, limit, offset });
  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const season = await seasonService.getSeason(req.params.seasonId);
  success(res, season);
}

export async function create(req, res) {
  const season = await seasonService.createSeason(req.body);
  created(res, season);
}

export async function update(req, res) {
  const season = await seasonService.updateSeason(req.params.seasonId, req.body);
  success(res, season, 'Updated successfully');
}

export async function remove(req, res) {
  const season = await seasonService.deleteSeason(req.params.seasonId);
  success(res, season, 'Deleted successfully');
}
