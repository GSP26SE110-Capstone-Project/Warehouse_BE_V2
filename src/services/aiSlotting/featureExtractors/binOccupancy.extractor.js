/**
 * Derive occupancy features from a bin row (DB snake_case or mapped camelCase).
 */
export function extractBinOccupancy(bin) {
  const maxVolume = Number(bin.maxVolumeUnits ?? bin.max_volume_units ?? 0);
  const usedVolume = Number(bin.usedVolumeUnits ?? bin.used_volume_units ?? 0);
  const maxLpn = Number(bin.maxLpnCount ?? bin.max_lpn_count ?? 0);
  const currentLpn = Number(bin.currentLpnCount ?? bin.current_lpn_count ?? 0);

  const volumeUsedRatio = maxVolume > 0 ? usedVolume / maxVolume : 1;
  const freeVolumeRatio = maxVolume > 0 ? 1 - volumeUsedRatio : 0;
  const lpnUsedRatio = maxLpn > 0 ? currentLpn / maxLpn : 1;
  const freeLpnRatio = maxLpn > 0 ? 1 - lpnUsedRatio : 0;

  const freeCapacity = (freeVolumeRatio + freeLpnRatio) / 2;

  const remainingVolumeUnits = Math.max(0, maxVolume - usedVolume);
  const remainingLpnSlots = Math.max(0, maxLpn - currentLpn);

  return {
    maxVolume,
    usedVolume,
    maxLpn,
    currentLpn,
    volumeUsedRatio,
    freeVolumeRatio,
    lpnUsedRatio,
    freeLpnRatio,
    freeCapacity,
    remainingVolumeUnits,
    remainingLpnSlots,
  };
}

export function binFitsLpnVolume(bin, lpnVolumeUnits) {
  const { remainingVolumeUnits, remainingLpnSlots } = extractBinOccupancy(bin);
  const vol = Number(lpnVolumeUnits) || 0;
  return remainingLpnSlots >= 1 && remainingVolumeUnits >= vol;
}
