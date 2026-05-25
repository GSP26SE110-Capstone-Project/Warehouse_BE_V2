import { SLOT_SCORE_WEIGHTS } from '../../../constants/aiSlotting.js';
import { extractBinOccupancy } from '../featureExtractors/binOccupancy.extractor.js';
import { scoreTenantReservation } from '../featureExtractors/tenantReservation.extractor.js';
import { scoreSameSkuCluster } from '../featureExtractors/skuCluster.extractor.js';

function scoreRackTypeMatch(suggestedRackType, binRackType) {
  if (!suggestedRackType) {
    return 0.7;
  }
  return suggestedRackType === binRackType ? 1 : 0;
}

/**
 * @returns {{ score: number, features: object, reasons: string[] }}
 */
export function scoreBinCandidate({
  bin,
  location,
  reservations,
  zonesWithSameSku,
  suggestedRackType,
}) {
  const occupancy = extractBinOccupancy(bin);
  const freeCapacity = occupancy.freeCapacity;
  const tenantReservationMatch = scoreTenantReservation(bin, location, reservations);
  const sameSkuCluster = scoreSameSkuCluster(location.zoneId, zonesWithSameSku);
  const rackTypeMatch = scoreRackTypeMatch(suggestedRackType, location.rackType);

  const score =
    freeCapacity * SLOT_SCORE_WEIGHTS.freeCapacity +
    tenantReservationMatch * SLOT_SCORE_WEIGHTS.tenantReservationMatch +
    sameSkuCluster * SLOT_SCORE_WEIGHTS.sameSkuCluster +
    rackTypeMatch * SLOT_SCORE_WEIGHTS.rackTypeMatch;

  const reasons = [];
  if (freeCapacity >= 0.5) {
    reasons.push(
      `${Math.round(occupancy.freeVolumeRatio * 100)}% free volume, ${occupancy.remainingLpnSlots} LPN slot(s) left`
    );
  } else if (freeCapacity > 0) {
    reasons.push('Limited free capacity on bin');
  }
  if (tenantReservationMatch >= 0.9) {
    reasons.push('Matches tenant storage reservation');
  } else if (tenantReservationMatch >= 0.3) {
    reasons.push('Shared bin available for tenant');
  }
  if (sameSkuCluster >= 1) {
    reasons.push('Same SKU stored in this zone');
  }
  if (rackTypeMatch >= 1 && suggestedRackType) {
    reasons.push(`Rack type ${suggestedRackType} matches LPN weight class`);
  } else if (suggestedRackType && rackTypeMatch < 1) {
    reasons.push(`Rack type ${location.rackType} does not match suggested ${suggestedRackType}`);
  }

  return {
    score: Math.round(score * 10000) / 10000,
    features: {
      freeCapacity,
      tenantReservationMatch,
      sameSkuCluster,
      rackTypeMatch,
      volumeUsedRatio: occupancy.volumeUsedRatio,
      remainingVolumeUnits: occupancy.remainingVolumeUnits,
      remainingLpnSlots: occupancy.remainingLpnSlots,
    },
    reasons,
  };
}
