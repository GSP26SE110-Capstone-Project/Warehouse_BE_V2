import { STORAGE_LEVEL } from '../constants/tenantOnboarding.js';
import AppError from './AppError.js';

/** Thứ tự nhỏ → lớn: BIN … WAREHOUSE */
export const STORAGE_LEVEL_RANK = Object.freeze({
  BIN: 1,
  RACK_LEVEL: 2,
  RACK: 3,
  ZONE: 4,
  WAREHOUSE: 5,
});

const CONTRACT_TYPE_DEFAULT_CEILING = Object.freeze({
  SHARED_STORAGE: 'BIN',
  RESERVED_STORAGE: 'BIN',
  DEDICATED_ZONE: 'ZONE',
  DEDICATED_WAREHOUSE: 'WAREHOUSE',
});

export function storageLevelRank(level) {
  const r = STORAGE_LEVEL_RANK[level];
  if (r == null) {
    throw new AppError(`storageLevel không hợp lệ: ${level}`, 400, 'VALIDATION_ERROR');
  }
  return r;
}

export function maxStorageLevel(levels) {
  const list = (levels || []).filter(Boolean);
  if (list.length === 0) return null;
  return list.reduce((best, cur) =>
    storageLevelRank(cur) > storageLevelRank(best) ? cur : best
  );
}

export function assertStorageLevelWithinCeiling(proposedLevel, ceilingLevel) {
  if (!ceilingLevel) return;
  if (storageLevelRank(proposedLevel) > storageLevelRank(ceilingLevel)) {
    throw new AppError(
      `Cấp thuê ${proposedLevel} cao hơn cấp hiện tại của hợp đồng (${ceilingLevel}). Vui lòng tạo hợp đồng mới thay vì phụ lục.`,
      400,
      'APPENDIX_NEED_NEW_CONTRACT'
    );
  }
}

/** Lấy cấp cao nhất trong danh sách items/reservations của yêu cầu PL. */
export function maxProposedStorageLevel({ items = [], reservations = [], requestedStorageLevel } = {}) {
  const levels = [];
  if (requestedStorageLevel) levels.push(requestedStorageLevel);
  for (const row of items) {
    if (row?.storageLevel) levels.push(row.storageLevel);
  }
  for (const row of reservations) {
    if (row?.storageLevel) levels.push(row.storageLevel);
  }
  return maxStorageLevel(levels);
}

export function defaultCeilingFromContractType(contractType) {
  return CONTRACT_TYPE_DEFAULT_CEILING[contractType] ?? 'BIN';
}

export function isValidStorageLevel(level) {
  return STORAGE_LEVEL.includes(level);
}
