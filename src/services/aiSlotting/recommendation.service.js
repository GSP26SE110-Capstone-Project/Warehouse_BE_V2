import pool from '../../config/db.js';
import AppError from '../../utils/AppError.js';
import { parseUuid } from '../../utils/validate.js';
import {
  AI_SLOTTING_MODEL_VERSION,
  SLOT_CANDIDATE_LIMIT,
  SLOT_TOP_ALTERNATIVES,
} from '../../constants/aiSlotting.js';
import { getLpn } from '../lpn.service.js';
import { getWarehouseById } from '../warehouse.service.js';
import { suggestRackTypeFromWeight } from '../lpnRackSuggestion.service.js';
import LpnDetail from '../../models/LpnDetail.js';
import { binFitsLpnVolume } from './featureExtractors/binOccupancy.extractor.js';
import { tenantCanUseBin } from './featureExtractors/tenantReservation.extractor.js';
import { scoreBinCandidate } from './scorers/ruleSlotting.scorer.js';

function mapCandidateRow(row) {
  return {
    binId: row.bin_id,
    binCode: row.bin_code,
    rackLevelId: row.rack_level_id,
    maxLpnCount: row.max_lpn_count,
    currentLpnCount: row.current_lpn_count,
    maxVolumeUnits: row.max_volume_units,
    usedVolumeUnits: row.used_volume_units,
    supportedBoxType: row.supported_box_type,
    reservationType: row.reservation_type,
    status: row.status,
    rackId: row.rack_id,
    rackCode: row.rack_code,
    rackType: row.rack_type,
    zoneId: row.zone_id,
    zoneCode: row.zone_code,
    zoneType: row.zone_type,
    warehouseId: row.warehouse_id,
  };
}

function buildReasonPayload(reasons, features) {
  return JSON.stringify({
    reasons,
    modelVersion: AI_SLOTTING_MODEL_VERSION,
    featureSnapshot: features,
  });
}

async function loadLpnSkuIds(lpnId) {
  const details = await LpnDetail.findAll({ lpnId });
  return [...new Set(details.map((d) => d.skuId).filter(Boolean))];
}

async function loadZonesWithSameSku(tenantId, warehouseId, skuIds) {
  if (!skuIds.length) {
    return new Set();
  }

  const result = await pool.query(
    `SELECT DISTINCT z.zone_id
     FROM inventories i
     INNER JOIN bins b ON b.bin_id = i.bin_id
     INNER JOIN rack_levels rl ON rl.rack_level_id = b.rack_level_id
     INNER JOIN racks r ON r.rack_id = rl.rack_id
     INNER JOIN warehouse_zones z ON z.zone_id = r.zone_id
     WHERE i.tenant_id = $1
       AND z.warehouse_id = $2
       AND i.sku_id = ANY($3::uuid[])
       AND i.quantity > 0`,
    [tenantId, warehouseId, skuIds]
  );

  return new Set(result.rows.map((r) => r.zone_id));
}

async function loadActiveReservations(tenantId, warehouseId) {
  const result = await pool.query(
    `SELECT reservation_id, storage_level, zone_id, rack_id, rack_level_id, bin_id,
            reservation_type
     FROM storage_reservations
     WHERE tenant_id = $1
       AND warehouse_id = $2
       AND status = 'ACTIVE'
       AND start_date <= CURRENT_DATE
       AND end_date >= CURRENT_DATE`,
    [tenantId, warehouseId]
  );

  return result.rows.map((row) => ({
    reservationId: row.reservation_id,
    storageLevel: row.storage_level,
    zoneId: row.zone_id,
    rackId: row.rack_id,
    rackLevelId: row.rack_level_id,
    binId: row.bin_id,
    reservationType: row.reservation_type,
  }));
}

async function loadCandidateBins({ warehouseId, rackType, weightKg, boxType }) {
  const params = [warehouseId];
  let paramIdx = 2;

  let rackTypeClause = '';
  if (rackType) {
    rackTypeClause = ` AND r.rack_type = $${paramIdx}`;
    params.push(rackType);
    paramIdx += 1;
  }

  let weightClause = '';
  if (weightKg != null) {
    weightClause = ` AND (rl.max_weight_kg IS NULL OR rl.max_weight_kg >= $${paramIdx})`;
    params.push(weightKg);
    paramIdx += 1;
  }

  let boxTypeClause = '';
  if (boxType) {
    boxTypeClause = ` AND (b.supported_box_type IS NULL OR b.supported_box_type = $${paramIdx})`;
    params.push(boxType);
    paramIdx += 1;
  }

  const limitParam = paramIdx;
  params.push(SLOT_CANDIDATE_LIMIT);

  const result = await pool.query(
    `SELECT b.bin_id, b.bin_code, b.rack_level_id,
            b.max_lpn_count, b.current_lpn_count,
            b.max_volume_units, b.used_volume_units,
            b.supported_box_type, b.reservation_type, b.status,
            rl.level_number, rl.max_weight_kg,
            r.rack_id, r.rack_code, r.rack_type,
            z.zone_id, z.zone_code, z.zone_type,
            w.warehouse_id
     FROM bins b
     INNER JOIN rack_levels rl ON rl.rack_level_id = b.rack_level_id
     INNER JOIN racks r ON r.rack_id = rl.rack_id
     INNER JOIN warehouse_zones z ON z.zone_id = r.zone_id
     INNER JOIN warehouses w ON w.warehouse_id = z.warehouse_id
     WHERE w.warehouse_id = $1
       AND z.status = 'ACTIVE'
       AND r.status = 'ACTIVE'
       AND b.status IN ('EMPTY', 'PARTIAL')
       ${rackTypeClause}
       ${weightClause}
       ${boxTypeClause}
     ORDER BY b.bin_code ASC
     LIMIT $${limitParam}`,
    params
  );

  return result.rows.map(mapCandidateRow);
}

/**
 * Rule-based slot recommendation for an LPN (preview, no DB write).
 */
export async function recommendSlotForLpn(lpnId, { warehouseId, inboundRequestId } = {}) {
  const lpnUuid = parseUuid(lpnId, 'lpnId');
  const whId = parseUuid(warehouseId, 'warehouseId');
  await getWarehouseById(whId);

  const lpn = await getLpn(lpnUuid);
  if (lpn.tenantId == null) {
    throw new AppError('LPN has no tenantId', 400, 'VALIDATION_ERROR');
  }

  if (inboundRequestId != null) {
    parseUuid(inboundRequestId, 'inboundRequestId');
  }

  const rackHint = suggestRackTypeFromWeight(lpn.weightKg);
  const suggestedRackType = rackHint.suggestedRackType;
  const weightKg = rackHint.weightKg;

  const skuIds = await loadLpnSkuIds(lpnUuid);
  const primarySkuId = skuIds[0] ?? null;

  const [zonesWithSameSku, reservations, rawCandidates] = await Promise.all([
    loadZonesWithSameSku(lpn.tenantId, whId, skuIds),
    loadActiveReservations(lpn.tenantId, whId),
    loadCandidateBins({
      warehouseId: whId,
      rackType: suggestedRackType,
      weightKg,
      boxType: lpn.boxType,
    }),
  ]);

  const scored = [];

  for (const bin of rawCandidates) {
    if (!binFitsLpnVolume(bin, lpn.volumeUnits)) {
      continue;
    }

    const location = {
      zoneId: bin.zoneId,
      rackId: bin.rackId,
      rackLevelId: bin.rackLevelId,
      binId: bin.binId,
      rackType: bin.rackType,
    };

    if (!tenantCanUseBin(bin, location, reservations)) {
      continue;
    }

    const { score, features, reasons } = scoreBinCandidate({
      bin,
      location,
      reservations,
      zonesWithSameSku,
      suggestedRackType,
    });

    if (score <= 0) {
      continue;
    }

    scored.push({
      recommendedZoneId: bin.zoneId,
      recommendedBinId: bin.binId,
      zoneCode: bin.zoneCode,
      binCode: bin.binCode,
      rackType: bin.rackType,
      score,
      reasons,
      features,
    });
  }

  scored.sort((a, b) => b.score - a.score);

  if (!scored.length) {
    throw new AppError(
      'No suitable bin found for this LPN in the warehouse (check capacity, reservations, or rack type)',
      404,
      'NO_SLOT_CANDIDATE'
    );
  }

  const best = scored[0];
  const alternatives = scored.slice(1, 1 + SLOT_TOP_ALTERNATIVES);

  return {
    lpnId: lpn.lpnId,
    lpnCode: lpn.lpnCode,
    tenantId: lpn.tenantId,
    warehouseId: whId,
    inboundRequestId: inboundRequestId ?? null,
    skuId: primarySkuId,
    skuIds,
    suggestedRackType,
    rackSuggestionReason: rackHint.reason,
    modelVersion: AI_SLOTTING_MODEL_VERSION,
    recommendedZoneId: best.recommendedZoneId,
    recommendedBinId: best.recommendedBinId,
    zoneCode: best.zoneCode,
    binCode: best.binCode,
    score: best.score,
    reasons: best.reasons,
    featureSnapshot: best.features,
    reasonPayload: buildReasonPayload(best.reasons, best.features),
    alternatives: alternatives.map((alt) => ({
      recommendedZoneId: alt.recommendedZoneId,
      recommendedBinId: alt.recommendedBinId,
      zoneCode: alt.zoneCode,
      binCode: alt.binCode,
      score: alt.score,
      reasons: alt.reasons,
    })),
  };
}
