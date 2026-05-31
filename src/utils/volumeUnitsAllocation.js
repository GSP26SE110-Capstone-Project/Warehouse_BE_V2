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
export function allocateBoxes(totalU) {
  let remaining = Number(totalU);
  if (!Number.isFinite(remaining) || remaining < 0) {
    throw new AppError('totalU must be a non-negative number', 400, 'VALIDATION_ERROR');
  }

  if (remaining === 0) {
    return {};
  }

  const allocation = {};

  for (const boxType of BOX_ORDER) {
    const vol = BOX_VOLUME_UNITS[boxType];
    const count = Math.floor(remaining / vol);
    if (count > 0) {
      allocation[boxType] = count;
      remaining -= count * vol;
    }
  }

  if (remaining > 0) {
    const ascending = [...BOX_ORDER].reverse();
    let picked = false;
    for (const boxType of ascending) {
      const vol = BOX_VOLUME_UNITS[boxType];
      if (vol >= remaining) {
        allocation[boxType] = (allocation[boxType] ?? 0) + 1;
        picked = true;
        break;
      }
    }
    if (!picked) {
      allocation.EXTRA = (allocation.EXTRA ?? 0) + 1;
    }
  }

  return allocation;
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

export function assertValidBoxTypeHint(value) {
  if (value == null || value === '') return undefined;
  const hint = String(value).trim().toUpperCase();
  if (!BOX_TYPE.includes(hint)) {
    throw new AppError('selectedBoxTypeHint is invalid', 400, 'VALIDATION_ERROR');
  }
  return hint;
}
