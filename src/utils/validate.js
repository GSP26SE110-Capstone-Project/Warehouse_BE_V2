import AppError from './AppError.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseUuid(value, fieldName = 'id') {
  if (!value || !UUID_REGEX.test(String(value))) {
    throw new AppError(`Invalid ${fieldName}`, 400, 'INVALID_ID');
  }
  return String(value);
}

export function assertEnum(value, allowed, fieldName) {
  if (value == null || value === '') return;
  if (!allowed.includes(value)) {
    throw new AppError(
      `Invalid ${fieldName}. Allowed values: ${allowed.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }
}

export function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
