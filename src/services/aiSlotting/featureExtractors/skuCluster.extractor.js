/**
 * @param {Set<string>} zonesWithSameSku
 */
export function scoreSameSkuCluster(zoneId, zonesWithSameSku) {
  if (!zonesWithSameSku?.size) {
    return 0;
  }
  return zonesWithSameSku.has(zoneId) ? 1 : 0;
}
