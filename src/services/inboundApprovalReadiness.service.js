import pool from '../config/db.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import Batch from '../models/Batch.js';
import InboundRequestItem from '../models/InboundRequestItem.js';
import ContractItem from '../models/ContractItem.js';
import { BOX_TYPE, BOX_VOLUME_UNITS } from '../constants/warehouseStructure.js';
import {
  DAYS_PER_BILLING_MONTH,
  DEFAULT_BIN_MAX_LPN_COUNT,
  DEFAULT_BIN_MAX_VOLUME_UNITS,
  HANDLING_UNIT_FALLBACK_PRICE,
  INBOUND_LPN_PRICE_BY_BOX_TYPE,
  STORAGE_BOX_DAY_PRICE_BY_BOX_TYPE,
} from '../constants/pricingDefaults.js';
import { getInboundRequest } from './inboundRequest.service.js';

/** Giả định khi chưa biết cách đóng thùng thật (ước tính duyệt inbound). */
export const DEFAULT_PIECES_PER_LPN = 25;
export const DEFAULT_VOLUME_UNITS_PER_LPN = 2;

function pickRecommendedBoxType(capacityByType) {
  return [...BOX_TYPE]
    .map((type) => ({ type, ...(capacityByType[type] ?? {}) }))
    .sort((a, b) => {
      if ((b.candidateBins ?? 0) !== (a.candidateBins ?? 0)) {
        return (b.candidateBins ?? 0) - (a.candidateBins ?? 0);
      }
      return (b.totalFreeVolumeUnits ?? 0) - (a.totalFreeVolumeUnits ?? 0);
    })[0]?.type;
}

async function queryBoxTypeCapacity(warehouseId) {
  const byType = {};

  for (const boxType of BOX_TYPE) {
    const volumeUnits = BOX_VOLUME_UNITS[boxType];
    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS candidate_bins,
         COALESCE(SUM(GREATEST(0, b.max_lpn_count - COALESCE(b.current_lpn_count, 0))), 0)::int AS total_free_lpn_slots,
         COALESCE(SUM(GREATEST(0, b.max_volume_units - COALESCE(b.used_volume_units, 0))), 0)::int AS total_free_volume_units
       FROM bins b
       INNER JOIN rack_levels rl ON rl.rack_level_id = b.rack_level_id
       INNER JOIN racks r ON r.rack_id = rl.rack_id
       INNER JOIN warehouse_zones z ON z.zone_id = r.zone_id
       WHERE z.warehouse_id = $1
         AND z.status = 'ACTIVE'
         AND r.status = 'ACTIVE'
         AND b.status IN ('EMPTY', 'PARTIAL')
         AND (b.supported_box_type IS NULL OR b.supported_box_type = $2)
         AND GREATEST(0, b.max_lpn_count - COALESCE(b.current_lpn_count, 0)) >= 1
         AND GREATEST(0, b.max_volume_units - COALESCE(b.used_volume_units, 0)) >= $3`,
      [warehouseId, boxType, volumeUnits]
    );

    const row = result.rows[0] ?? {};
    byType[boxType] = {
      candidateBins: row.candidate_bins ?? 0,
      totalFreeLpnSlots: row.total_free_lpn_slots ?? 0,
      totalFreeVolumeUnits: row.total_free_volume_units ?? 0,
      volumeUnits,
    };
  }

  const recommendedBoxType = pickRecommendedBoxType(byType) ?? 'MEDIUM';
  return {
    byType,
    recommendedBoxType,
    recommendedVolumeUnits: BOX_VOLUME_UNITS[recommendedBoxType] ?? DEFAULT_VOLUME_UNITS_PER_LPN,
  };
}

function parsePrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function findContractPrice(items, filters, fallback) {
  const match = items.find((it) =>
    Object.entries(filters).every(([k, v]) => {
      if (v == null) return true;
      return it[k] === v;
    })
  );
  return match ? parsePrice(match.unitPrice) : fallback;
}

async function computePricingEstimate(inbound, assumedBoxType, estimatedLpnNeeded) {
  const items = await ContractItem.findAll({ contractId: inbound.contractId });

  const inboundLpnUnitPrice = findContractPrice(
    items,
    { itemType: 'INBOUND', billingUnit: 'INBOUND_LPN', boxType: assumedBoxType },
    INBOUND_LPN_PRICE_BY_BOX_TYPE[assumedBoxType] ?? INBOUND_LPN_PRICE_BY_BOX_TYPE.MEDIUM
  );

  const storageBoxDayUnitPrice = findContractPrice(
    items,
    {
      itemType: 'STORAGE',
      billingUnit: 'BOX_DAY',
      storageLevel: 'BIN',
      boxType: assumedBoxType,
    },
    STORAGE_BOX_DAY_PRICE_BY_BOX_TYPE[assumedBoxType] ??
      STORAGE_BOX_DAY_PRICE_BY_BOX_TYPE.MEDIUM
  );

  const handlingUnitPrice = findContractPrice(
    items,
    { itemType: 'HANDLING', billingUnit: 'HANDLING_UNIT', boxType: null },
    HANDLING_UNIT_FALLBACK_PRICE
  );

  const hasInboundItem = items.some(
    (it) =>
      it.itemType === 'INBOUND' &&
      it.billingUnit === 'INBOUND_LPN' &&
      it.boxType === assumedBoxType
  );
  const hasStorageItem = items.some(
    (it) =>
      it.itemType === 'STORAGE' &&
      it.billingUnit === 'BOX_DAY' &&
      it.storageLevel === 'BIN' &&
      it.boxType === assumedBoxType
  );
  const hasHandlingItem = items.some(
    (it) => it.itemType === 'HANDLING' && it.billingUnit === 'HANDLING_UNIT'
  );

  const estimatedAvgBoxesForMonth = estimatedLpnNeeded;

  const estimatedMonthlyStorageCost =
    estimatedAvgBoxesForMonth * storageBoxDayUnitPrice * DAYS_PER_BILLING_MONTH;

  return {
    hasPricing: true,
    inboundLpnUnitPrice,
    handlingUnitPrice,
    storageBoxDayUnitPrice,
    billingDaysPerMonth: DAYS_PER_BILLING_MONTH,
    estimatedAvgBoxesForMonth,
    estimatedMonthlyStorageCost,
    currency: 'VND',
    usedFallback: !hasInboundItem || !hasHandlingItem || !hasStorageItem,
    fallbackInboundLpnUsed: !hasInboundItem,
    fallbackHandlingUsed: !hasHandlingItem,
    fallbackStorageUsed: !hasStorageItem,
  };
}

async function queryWarehousePutawayCapacity(warehouseId) {
  const result = await pool.query(
    `SELECT
       COUNT(*)::int AS total_bins,
       COUNT(*) FILTER (WHERE b.status IN ('EMPTY', 'PARTIAL'))::int AS putaway_eligible_bins,
       COUNT(*) FILTER (WHERE b.status = 'EMPTY')::int AS empty_bins,
       COALESCE(
         SUM(GREATEST(0, b.max_lpn_count - COALESCE(b.current_lpn_count, 0)))
         FILTER (WHERE b.status IN ('EMPTY', 'PARTIAL')),
         0
       )::int AS free_lpn_slots,
       COALESCE(
         SUM(GREATEST(0, b.max_volume_units - COALESCE(b.used_volume_units, 0)))
         FILTER (WHERE b.status IN ('EMPTY', 'PARTIAL')),
         0
       )::int AS free_volume_units
     FROM bins b
     INNER JOIN rack_levels rl ON rl.rack_level_id = b.rack_level_id
     INNER JOIN racks r ON r.rack_id = rl.rack_id
     INNER JOIN warehouse_zones z ON z.zone_id = r.zone_id
     WHERE z.warehouse_id = $1
       AND z.status = 'ACTIVE'
       AND r.status = 'ACTIVE'
       AND b.status NOT IN ('BLOCKED', 'RESERVED')`,
    [warehouseId]
  );

  const row = result.rows[0] ?? {};
  return {
    totalBins: row.total_bins ?? 0,
    putawayEligibleBins: row.putaway_eligible_bins ?? 0,
    emptyBins: row.empty_bins ?? 0,
    freeLpnSlots: row.free_lpn_slots ?? 0,
    freeVolumeUnits: row.free_volume_units ?? 0,
  };
}

export async function getInboundApprovalReadiness(inboundRequestId) {
  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  const inbound = await getInboundRequest(id);
  const items = await InboundRequestItem.findAll({ inboundRequestId: id });
  const batches = await Batch.findAll({ inboundRequestId: id });

  const totalExpectedPieces = items.reduce(
    (sum, item) => sum + Number(item.expectedQuantity ?? 0),
    0
  );

  const boxTypeCapacity = await queryBoxTypeCapacity(inbound.warehouseId);
  const byType = boxTypeCapacity.byType ?? {};

  const piecesPerLpnForBoxType = (boxType) => {
    const volumeUnits = BOX_VOLUME_UNITS[boxType] ?? DEFAULT_VOLUME_UNITS_PER_LPN;
    // Heuristic: bigger carton holds more pieces (ước tính để suggest “extra” khi hàng nhiều).
    const ratio = volumeUnits / DEFAULT_VOLUME_UNITS_PER_LPN;
    return Math.max(1, Math.round(DEFAULT_PIECES_PER_LPN * ratio));
  };

  const evaluate = (boxType) => {
    const cand = byType[boxType] ?? {
      candidateBins: 0,
      totalFreeLpnSlots: 0,
      totalFreeVolumeUnits: 0,
      volumeUnits: BOX_VOLUME_UNITS[boxType] ?? DEFAULT_VOLUME_UNITS_PER_LPN,
    };
    const piecesPerLpn = piecesPerLpnForBoxType(boxType);
    const volumeUnitsPerLpn = cand.volumeUnits;
    const estimatedLpnNeeded =
      totalExpectedPieces > 0 ? Math.ceil(totalExpectedPieces / piecesPerLpn) : 0;
    const estimatedVolumeUnitsNeeded = estimatedLpnNeeded * volumeUnitsPerLpn;

    const sufficientLpnSlots = cand.totalFreeLpnSlots >= estimatedLpnNeeded;
    const sufficientVolume = cand.totalFreeVolumeUnits >= estimatedVolumeUnitsNeeded;
    const sufficient = sufficientLpnSlots && sufficientVolume;

    const scoreLpn = estimatedLpnNeeded > 0 ? cand.totalFreeLpnSlots / estimatedLpnNeeded : 0;
    const scoreVol =
      estimatedVolumeUnitsNeeded > 0 ? cand.totalFreeVolumeUnits / estimatedVolumeUnitsNeeded : 0;
    const score = (scoreLpn + scoreVol) / 2;

    return {
      boxType,
      piecesPerLpn,
      volumeUnitsPerLpn,
      estimatedLpnNeeded,
      estimatedVolumeUnitsNeeded,
      candidateBins: cand.candidateBins ?? 0,
      cand,
      sufficient,
      score,
    };
  };

  const evaluations = BOX_TYPE.map((t) => evaluate(t));
  const best = evaluations.sort((a, b) => {
    if (a.sufficient !== b.sufficient) return a.sufficient ? -1 : 1;
    if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
    if ((a.estimatedLpnNeeded ?? 0) !== (b.estimatedLpnNeeded ?? 0))
      return (a.estimatedLpnNeeded ?? 0) - (b.estimatedLpnNeeded ?? 0);
    return (b.candidateBins ?? 0) - (a.candidateBins ?? 0);
  })[0];

  const assumedBoxType = best?.boxType ?? 'MEDIUM';
  const assumedPiecesPerLpn = best?.piecesPerLpn ?? DEFAULT_PIECES_PER_LPN;
  const assumedVolumeUnitsPerLpn = best?.volumeUnitsPerLpn ?? DEFAULT_VOLUME_UNITS_PER_LPN;
  const estimatedLpnNeeded = best?.estimatedLpnNeeded ?? 0;
  const estimatedVolumeUnitsNeeded = best?.estimatedVolumeUnitsNeeded ?? 0;
  const assumedCandidate = best?.cand ?? byType[assumedBoxType] ?? {};

  const warehouseStorage = await queryWarehousePutawayCapacity(inbound.warehouseId);
  const pricing = await computePricingEstimate(inbound, assumedBoxType, estimatedLpnNeeded);

  const estimatedBinsNeeded =
    estimatedLpnNeeded > 0
      ? Math.max(
          Math.ceil(estimatedVolumeUnitsNeeded / DEFAULT_BIN_MAX_VOLUME_UNITS),
          Math.ceil(estimatedLpnNeeded / DEFAULT_BIN_MAX_LPN_COUNT)
        )
      : 0;

  const sufficientLpnSlots = assumedCandidate.totalFreeLpnSlots >= estimatedLpnNeeded;
  const sufficientVolume = assumedCandidate.totalFreeVolumeUnits >= estimatedVolumeUnitsNeeded;
  const sufficient = sufficientLpnSlots && sufficientVolume;

  const warnings = [];
  if (items.length === 0) {
    warnings.push('Inbound chưa có dòng hàng — khó ước tính chỗ trống.');
  }

  if (pricing.fallbackInboundLpnUsed) {
    warnings.push(
      `Contract chưa có unit price INBOUND_LPN — dùng giá tham khảo từ docs/pricing.md (theo ${assumedBoxType}).`
    );
  }
  if (pricing.fallbackHandlingUsed) {
    warnings.push(
      'Contract chưa có unit price HANDLING_UNIT — dùng giá tham khảo từ docs/pricing.md.'
    );
  }
  if (pricing.fallbackStorageUsed) {
    warnings.push(
      `Contract chưa có STORAGE BOX_DAY (BIN, ${assumedBoxType}) — dùng giá tham khảo từ docs/pricing.md.`
    );
  }

  if (!sufficientLpnSlots) {
    warnings.push(
      `Thiếu slot LPN cho boxType ${assumedBoxType}: cần ~${estimatedLpnNeeded}, kho còn ~${assumedCandidate.totalFreeLpnSlots} slot (bin EMPTY/PARTIAL) khả dụng cho loại thùng này.`
    );
  }
  if (!sufficientVolume) {
    warnings.push(
      `Thiếu volume cho boxType ${assumedBoxType}: cần ~${estimatedVolumeUnitsNeeded} volume units, kho còn ~${assumedCandidate.totalFreeVolumeUnits}.`
    );
  }
  if (warehouseStorage.putawayEligibleBins === 0) {
    warnings.push('Không có bin EMPTY/PARTIAL khả dụng trong kho.');
  }

  const batchCount = batches.length;
  const status = inbound.status;

  const estimatedInboundLpnCost =
    pricing.inboundLpnUnitPrice != null
      ? estimatedLpnNeeded * pricing.inboundLpnUnitPrice
      : null;
  const estimatedHandlingCost =
    pricing.handlingUnitPrice != null
      ? estimatedLpnNeeded * pricing.handlingUnitPrice
      : null;
  const estimatedOneTimeOpsCost =
    (estimatedInboundLpnCost ?? 0) + (estimatedHandlingCost ?? 0);
  const estimatedMonthlyStorageCost = pricing.estimatedMonthlyStorageCost ?? 0;
  const estimatedFirstMonthTotal =
    estimatedOneTimeOpsCost + estimatedMonthlyStorageCost;

  return {
    inboundRequestId: id,
    status,
    warehouseId: inbound.warehouseId,
    totalExpectedPieces,
    inboundLineCount: items.length,
    assumptions: {
      piecesPerLpn: assumedPiecesPerLpn,
      volumeUnitsPerLpn: assumedVolumeUnitsPerLpn,
      boxType: assumedBoxType,
      binMaxLpnCount: DEFAULT_BIN_MAX_LPN_COUNT,
      binMaxVolumeUnits: DEFAULT_BIN_MAX_VOLUME_UNITS,
    },
    estimatedBinsNeeded,
    boxTypeCapacity: boxTypeCapacity.byType,
    boxTypeSuggestion: {
      recommendedBoxType: assumedBoxType,
      reason: best?.sufficient
        ? `Ước tính dùng ~${estimatedLpnNeeded} LPN với giả định ~${assumedPiecesPerLpn} cái/thùng. Loại thùng này vẫn đủ slot LPN & volume cho boxType.`
        : `Đề xuất ${assumedBoxType} vì giả định ~${assumedPiecesPerLpn} cái/thùng giúp cần ít LPN hơn; có thể thiếu slot LPN/volume cho loại thùng này.`,
    },
    estimatedLpnNeeded,
    estimatedVolumeUnitsNeeded,
    warehouseStorage,
    sufficient,
    sufficientLpnSlots,
    sufficientVolume,
    pricingEstimate: {
      ...pricing,
      estimatedInboundLpnCost,
      estimatedHandlingCost,
      estimatedOneTimeOpsCost: pricing.hasPricing ? estimatedOneTimeOpsCost : null,
      estimatedMonthlyStorageCost: pricing.hasPricing ? estimatedMonthlyStorageCost : null,
      estimatedFirstMonthTotal: pricing.hasPricing ? estimatedFirstMonthTotal : null,
      /** @deprecated use estimatedOneTimeOpsCost */
      estimatedTotalCost: pricing.hasPricing ? estimatedOneTimeOpsCost : null,
    },
    warnings,
    batchCount,
    canRevokeApproval: status === 'APPROVED' && batchCount === 0,
    canWarehouseCancel: ['PENDING', 'APPROVED', 'ARRIVED'].includes(status),
    canWarehouseReject: status === 'PENDING',
  };
}

export async function assertNoInboundReceivingActivity(inboundRequestId) {
  const id = parseUuid(inboundRequestId, 'inboundRequestId');
  const batches = await Batch.findAll({ inboundRequestId: id });
  if (batches.length > 0) {
    throw new AppError(
      'Cannot change status: receiving batches already exist for this inbound',
      400,
      'INBOUND_HAS_RECEIVING_ACTIVITY'
    );
  }
}
