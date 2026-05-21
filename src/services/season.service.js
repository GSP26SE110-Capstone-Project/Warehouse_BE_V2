import Season from '../models/Season.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';

const CREATE_FIELDS = ['seasonName'];
const UPDATE_FIELDS = ['seasonName'];

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

async function findByName(seasonName, excludeId = null) {
  const rows = await Season.findAll({});
  const normalized = seasonName.trim().toLowerCase();
  return rows.find(
    (row) =>
      row.seasonName?.trim().toLowerCase() === normalized &&
      row.seasonId !== excludeId
  );
}

function normalizeCreatePayload(body) {
  const data = pickFields(body, CREATE_FIELDS);
  data.seasonName = normalizeName(data.seasonName, 'seasonName');
  return data;
}

function normalizeUpdatePayload(body) {
  const data = pickFields(body, UPDATE_FIELDS);

  if (data.seasonName != null) {
    data.seasonName = normalizeName(data.seasonName, 'seasonName');
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
  }

  return data;
}

export async function getSeason(seasonId) {
  const id = parseUuid(seasonId, 'seasonId');
  const season = await Season.findById(id);
  if (!season) {
    throw new AppError('Season not found', 404, 'NOT_FOUND');
  }
  return season;
}

export async function listSeasons({ page, limit, offset }) {
  const [items, total] = await Promise.all([
    Season.findAll({}, { orderBy: 'season_name ASC', limit, offset }),
    Season.count({}),
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

export async function createSeason(body) {
  const data = normalizeCreatePayload(body);
  const duplicate = await findByName(data.seasonName);
  if (duplicate) {
    throw new AppError('Season name already exists', 409, 'DUPLICATE');
  }
  return Season.create(data);
}

export async function updateSeason(seasonId, body) {
  const id = parseUuid(seasonId, 'seasonId');
  await getSeason(id);

  const data = normalizeUpdatePayload(body);
  if (data.seasonName) {
    const duplicate = await findByName(data.seasonName, id);
    if (duplicate) {
      throw new AppError('Season name already exists', 409, 'DUPLICATE');
    }
  }

  return Season.updateById(id, data);
}

export async function deleteSeason(seasonId) {
  const id = parseUuid(seasonId, 'seasonId');
  await getSeason(id);

  const deleted = await Season.deleteById(id);
  if (!deleted) {
    throw new AppError('Season not found', 404, 'NOT_FOUND');
  }
  return deleted;
}
