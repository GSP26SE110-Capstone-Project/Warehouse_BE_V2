import { BOX_VOLUME_UNITS } from './warehouseStructure.js';

/** Mặc định sức chứa bin theo loại zone — đồng bộ với FE binCapacityDefaults.ts */
const ZONE_BIN_PRESETS = Object.freeze({
  SHARED: { maxVolumeUnits: 16 },
  PREMIUM: { maxVolumeUnits: 4 },
  PRIVATE: { maxVolumeUnits: 16 },
});

const FALLBACK_PRESET = ZONE_BIN_PRESETS.SHARED;

const BOX_TYPE_PRIORITY = ['EXTRA', 'LARGE', 'MEDIUM', 'SMALL'];

export function getDefaultBinCapacityForZone(zoneType) {
  if (!zoneType) return FALLBACK_PRESET;
  return ZONE_BIN_PRESETS[String(zoneType).toUpperCase()] ?? FALLBACK_PRESET;
}

/** LPN box type lớn nhất mà bin mặc định của zone chứa được (theo maxVolumeUnits). */
export function getMaxLpnBoxTypeForZone(zoneType) {
  const vol = getDefaultBinCapacityForZone(zoneType).maxVolumeUnits;
  for (const boxType of BOX_TYPE_PRIORITY) {
    if (BOX_VOLUME_UNITS[boxType] <= vol) return boxType;
  }
  return 'SMALL';
}

/** Chọn loại thùng lớn nhất trong các zone được cấp (tối ưu số LPN / chi phí tenant). */
export function pickLargestBoxTypeForZoneTypes(zoneTypes) {
  const types = zoneTypes?.length ? zoneTypes : ['SHARED'];
  let best = 'SMALL';
  let bestVol = 0;
  for (const zt of types) {
    const boxType = getMaxLpnBoxTypeForZone(zt);
    const vol = BOX_VOLUME_UNITS[boxType] ?? 0;
    if (vol > bestVol) {
      bestVol = vol;
      best = boxType;
    }
  }
  return best;
}
