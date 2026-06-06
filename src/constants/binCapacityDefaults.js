import { BOX_VOLUME_UNITS } from './warehouseStructure.js';

/** Mặc định sức chứa bin theo loại zone — đồng bộ với FE binCapacityDefaults.ts */
const ZONE_BIN_PRESETS = Object.freeze({
  SHARED: { maxVolumeUnits: 16 },
  PREMIUM: { maxVolumeUnits: 4 },
  PRIVATE: { maxVolumeUnits: 16 },
});

const FALLBACK_PRESET = ZONE_BIN_PRESETS.SHARED;

const BOX_TYPE_PRIORITY = ['EXTRA', 'LARGE', 'MEDIUM', 'SMALL'];

/** Loại thùng LPN lớn nhất theo nghiệp vụ zone — đồng bộ FE binCapacityDefaults.ts */
const ZONE_MAX_LPN_BOX_TYPE = Object.freeze({
  SHARED: 'EXTRA',
  PREMIUM: 'LARGE',
  PRIVATE: 'LARGE',
});

export function getDefaultBinCapacityForZone(zoneType) {
  if (!zoneType) return FALLBACK_PRESET;
  return ZONE_BIN_PRESETS[String(zoneType).toUpperCase()] ?? FALLBACK_PRESET;
}

/** LPN box type lớn nhất gợi ý cho zone (SHARED → EXTRA; PREMIUM/PRIVATE → LARGE). */
export function getMaxLpnBoxTypeForZone(zoneType) {
  const key = String(zoneType ?? 'SHARED').toUpperCase();
  if (ZONE_MAX_LPN_BOX_TYPE[key]) return ZONE_MAX_LPN_BOX_TYPE[key];
  if (key === 'FAST_MOVING') return 'LARGE';
  return 'EXTRA';
}

/** Số LPN cỡ lớn nhất của zone có thể xếp trong 1 ô bin (theo volume bin + loại thùng zone). */
export function maxLpnsPerBinSlotForZone(zoneType) {
  const maxBoxType = getMaxLpnBoxTypeForZone(zoneType);
  const binVolume = getDefaultBinCapacityForZone(zoneType).maxVolumeUnits;
  const boxVol = BOX_VOLUME_UNITS[maxBoxType] ?? 1;
  return Math.max(1, Math.floor(binVolume / boxVol));
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
