import { RACK_FIXED_LEVEL_COUNT } from './warehouseStructure.js';

/** Diện tích sàn mỗi rack (quần áo, STANDARD 3 tầng) */
export const RACK_FOOTPRINT_M2 = 3;

/** Quy đổi m² → 1 ô bin */
export const BIN_SLOT_FOOTPRINT_M2 = 0.25;

/**
 * Tỷ lệ diện tích zone dành cho lối đi xe (forklift / xe kéo).
 * Phần còn lại mới đặt rack.
 * VD: 0.30 = 30% lối đi, 70% đặt rack.
 */
export const ZONE_AISLE_RATIO = 0.3;

/** Diện tích zone tham chiếu để gợi ý số zone tối thiểu (capstone). */
export const REFERENCE_ZONE_AREA_M2 = 50;

export function computeZoneStorageCapacity(areaM2) {
  const area = Number(areaM2);
  if (!Number.isFinite(area) || area <= 0) {
    return {
      hasArea: false,
      maxRacks: 0,
      binsPerLevel: 0,
      totalBinSlots: 0,
      areaM2: areaM2 ?? null,
      aisleAreaM2: 0,
      storageAreaM2: 0,
      aisleRatio: ZONE_AISLE_RATIO,
    };
  }

  const aisleAreaM2 = area * ZONE_AISLE_RATIO;
  const storageAreaM2 = area - aisleAreaM2;

  const maxRacks = Math.floor(storageAreaM2 / RACK_FOOTPRINT_M2);
  const totalBinSlots = Math.floor(storageAreaM2 / BIN_SLOT_FOOTPRINT_M2);
  const binsPerLevel =
    maxRacks > 0
      ? Math.max(1, Math.floor(totalBinSlots / (maxRacks * RACK_FIXED_LEVEL_COUNT)))
      : 0;

  return {
    hasArea: true,
    areaM2: area,
    aisleAreaM2,
    storageAreaM2,
    aisleRatio: ZONE_AISLE_RATIO,
    maxRacks,
    binsPerLevel,
    totalBinSlots,
  };
}
