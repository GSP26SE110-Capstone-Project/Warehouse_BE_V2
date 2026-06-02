import { BOX_TYPE, BOX_VOLUME_UNITS } from '../constants/warehouseStructure.js';
import AppError from './AppError.js';

const BOX_ORDER = ['EXTRA', 'LARGE', 'MEDIUM', 'SMALL'];

export function roundVolumeUnits(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

/**
 * Greedy box allocation (doc rental-volume-units-flow E2).
 * @param {number} totalU
 * @returns {Record<string, number>}
 */
function allocateBoxesWithAllowed(allowed, totalU) {
  let remaining = roundVolumeUnits(Number(totalU));
  if (!Number.isFinite(remaining) || remaining <= 0) return {};

  const allocation = {};
  /** Không floor-chia SMALL — phần dư gom một thùng nhỏ nhất vừa đủ (tránh 2× Small). */
  const floorTypes = allowed.filter((t) => t !== 'SMALL');

  for (const boxType of floorTypes) {
    const vol = BOX_VOLUME_UNITS[boxType];
    const count = Math.floor(remaining / vol);
    if (count > 0) {
      allocation[boxType] = count;
      remaining = roundVolumeUnits(remaining - count * vol);
    }
  }

  if (remaining > 0) {
    const ascending = [...allowed].reverse();
    let picked = false;
    for (const boxType of ascending) {
      const vol = BOX_VOLUME_UNITS[boxType];
      if (vol >= remaining) {
        allocation[boxType] = (allocation[boxType] ?? 0) + 1;
        picked = true;
        break;
      }
    }
    if (!picked && allowed.includes('EXTRA')) {
      allocation.EXTRA = (allocation.EXTRA ?? 0) + 1;
    }
  }

  return allocation;
}

export function allocateBoxes(totalU) {
  const remaining = Number(totalU);
  if (!Number.isFinite(remaining) || remaining < 0) {
    throw new AppError('totalU must be a non-negative number', 400, 'VALIDATION_ERROR');
  }
  if (remaining === 0) return {};
  return allocateBoxesWithAllowed(BOX_ORDER, totalU);
}

export function allocationToArray(allocation) {
  return BOX_ORDER.filter((boxType) => allocation[boxType] > 0).map((boxType) => ({
    boxType,
    count: allocation[boxType],
  }));
}

export function totalBoxCount(allocation) {
  return Object.values(allocation).reduce((sum, count) => sum + count, 0);
}

/**
 * Phân bổ thùng/LPN theo tổng U, chỉ dùng các loại ≤ maxBoxType (vd. zone HĐ chỉ LARGE).
 * @param {string} maxBoxType
 * @param {number} totalU
 * @returns {Record<string, number>}
 */
export function allocateBoxesUpTo(maxBoxType, totalU) {
  const maxIdx = BOX_ORDER.indexOf(maxBoxType);
  const allowed = maxIdx >= 0 ? BOX_ORDER.slice(maxIdx) : [...BOX_ORDER];
  return allocateBoxesWithAllowed(allowed, totalU);
}

export function mergeAllocationRows(rows) {
  const map = new Map();
  for (const row of rows) {
    map.set(row.boxType, (map.get(row.boxType) ?? 0) + row.count);
  }
  return BOX_ORDER.filter((t) => (map.get(t) ?? 0) > 0).map((boxType) => ({
    boxType,
    count: map.get(boxType),
  }));
}

export function assertValidBoxTypeHint(value) {
  if (value == null || value === '') return undefined;
  const hint = String(value).trim().toUpperCase();
  if (!BOX_TYPE.includes(hint)) {
    throw new AppError('selectedBoxTypeHint is invalid', 400, 'VALIDATION_ERROR');
  }
  return hint;
}
