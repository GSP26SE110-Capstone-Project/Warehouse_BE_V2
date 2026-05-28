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

const BOX_TYPE_PRIORITY = ['EXTRA', 'LARGE', 'MEDIUM', 'SMALL'];

function buildProjectedBoxTypeCapacity(projectedBinSlots) {
  const byType = {};
  for (const boxType of BOX_TYPE) {
    const volumeUnits = BOX_VOLUME_UNITS[boxType];
    const maxLpnPerBin = Math.min(
      DEFAULT_BIN_MAX_LPN_COUNT,
      Math.floor(DEFAULT_BIN_MAX_VOLUME_UNITS / volumeUnits)
    );
    const boxesByVolume = projectedBinSlots * Math.floor(DEFAULT_BIN_MAX_VOLUME_UNITS / volumeUnits);
    byType[boxType] = {
      candidateBins: projectedBinSlots,
      estimatedBoxCapacity: boxesByVolume,
      totalFreeLpnSlots: projectedBinSlots * maxLpnPerBin,
      totalFreeVolumeUnits: projectedBinSlots * DEFAULT_BIN_MAX_VOLUME_UNITS,
      volumeUnits,
    };
  }
  return byType;
}

/** Đếm trên bin PARTIAL: còn nhận thêm bao nhiêu LPN theo từng box type. */
async function queryPartialBinFitByType(warehouseId) {
  const result = await pool.query(
    `SELECT
       GREATEST(0, b.max_lpn_count - COALESCE(b.current_lpn_count, 0))::int AS free_lpn,
       GREATEST(0, b.max_volume_units - COALESCE(b.used_volume_units, 0))::int AS free_vol
     FROM bins b
     INNER JOIN rack_levels rl ON rl.rack_level_id = b.rack_level_id
     INNER JOIN racks r ON r.rack_id = rl.rack_id
     INNER JOIN warehouse_zones z ON z.zone_id = r.zone_id
     WHERE z.warehouse_id = $1
       AND z.status = 'ACTIVE'
       AND r.status = 'ACTIVE'
       AND b.status = 'PARTIAL'
       AND b.status NOT IN ('BLOCKED', 'RESERVED')`,
    [warehouseId]
  );

  const byType = {};
  for (const boxType of BOX_TYPE) {
    byType[boxType] = { binsCanAcceptOneMore: 0, additionalLpnCapacity: 0 };
  }

  for (const row of result.rows) {
    const freeLpn = row.free_lpn ?? 0;
    const freeVol = row.free_vol ?? 0;
    for (const boxType of BOX_TYPE) {
      const volumeUnits = BOX_VOLUME_UNITS[boxType];
      if (freeLpn >= 1 && freeVol >= volumeUnits) {
        byType[boxType].binsCanAcceptOneMore += 1;
        byType[boxType].additionalLpnCapacity += Math.min(
          freeLpn,
          Math.floor(freeVol / volumeUnits)
        );
      }
    }
  }

  return byType;
}

function formatPartialAlternateNotes(partialFitByType, excludeType = null) {
  const parts = [];
  for (const boxType of BOX_TYPE_PRIORITY) {
    if (boxType === excludeType) continue;
    const fit = partialFitByType[boxType];
    if ((fit?.additionalLpnCapacity ?? 0) > 0) {
      parts.push(
        `~${fit.additionalLpnCapacity} ${boxType} (${fit.binsCanAcceptOneMore} bin đang dở)`
      );
    }
  }
  if (!parts.length) return [];
  return [`Trên bin đang dở còn nhận thêm: ${parts.join('; ')}.`];
}

function buildBoxTypeSuggestion(capacityByType, partialFitByType) {
  const extra = capacityByType.EXTRA ?? {};
  const extraPartial = partialFitByType.EXTRA ?? {};

  const extraBoxes = extra.estimatedBoxCapacity ?? extra.totalFreeLpnSlots ?? 0;
  if ((extra.candidateBins ?? 0) > 0) {
    return {
      recommendedBoxType: 'EXTRA',
      reason: `Ưu tiên EXTRA: ${extra.candidateBins} bin trống/đủ chỗ đặt thêm EXTRA (~${extraBoxes} thùng).`,
      alternateNotes: formatPartialAlternateNotes(partialFitByType, 'EXTRA'),
    };
  }

  if ((extraPartial.binsCanAcceptOneMore ?? 0) > 0) {
    return {
      recommendedBoxType: 'EXTRA',
      reason: `Ưu tiên EXTRA: ${extraPartial.binsCanAcceptOneMore} bin đang dở còn đủ volume/slot cho thêm EXTRA.`,
      alternateNotes: formatPartialAlternateNotes(partialFitByType, 'EXTRA'),
    };
  }

  for (const boxType of ['LARGE', 'MEDIUM', 'SMALL']) {
    const cap = capacityByType[boxType] ?? {};
    if ((cap.candidateBins ?? 0) > 0) {
      return {
        recommendedBoxType: boxType,
        reason: `Không còn bin đủ chỗ cho EXTRA; gợi ý ${boxType} (${cap.candidateBins} bin, ~${cap.estimatedBoxCapacity ?? cap.totalFreeLpnSlots ?? 0} thùng).`,
        alternateNotes: formatPartialAlternateNotes(partialFitByType, boxType),
      };
    }
  }

  for (const boxType of ['LARGE', 'MEDIUM', 'SMALL']) {
    const fit = partialFitByType[boxType] ?? {};
    if ((fit.binsCanAcceptOneMore ?? 0) > 0) {
      return {
        recommendedBoxType: boxType,
        reason: `Không đủ chỗ EXTRA; bin đang dở phù hợp nhất với ${boxType} (~${fit.additionalLpnCapacity} thùng thêm).`,
        alternateNotes: formatPartialAlternateNotes(partialFitByType, boxType),
      };
    }
  }

  return {
    recommendedBoxType: 'EXTRA',
    reason:
      'Ưu tiên EXTRA khi putaway; hiện chưa có bin khả dụng (hoặc chưa tạo rack/bin — xem số ước tính bên dưới).',
    alternateNotes: [],
  };
}

async function queryBoxTypeCapacity(warehouseId) {
  const byType = {};
  const partialFitByType = await queryPartialBinFitByType(warehouseId);

  for (const boxType of BOX_TYPE) {
    const volumeUnits = BOX_VOLUME_UNITS[boxType];
    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS candidate_bins,
         COALESCE(SUM(
           FLOOR(
             GREATEST(0, b.max_volume_units - COALESCE(b.used_volume_units, 0))::numeric
             / $3::numeric
           )::int
         ), 0)::int AS volume_based_boxes,
         COALESCE(SUM(
           LEAST(
             GREATEST(0, b.max_lpn_count - COALESCE(b.current_lpn_count, 0)),
             FLOOR(
               GREATEST(0, b.max_volume_units - COALESCE(b.used_volume_units, 0))::numeric
               / $3::numeric
             )::int
           )
         ), 0)::int AS total_free_lpn_slots,
         COALESCE(SUM(GREATEST(0, b.max_volume_units - COALESCE(b.used_volume_units, 0))), 0)::int AS total_free_volume_units
       FROM bins b
       INNER JOIN rack_levels rl ON rl.rack_level_id = b.rack_level_id
       INNER JOIN racks r ON r.rack_id = rl.rack_id
       INNER JOIN warehouse_zones z ON z.zone_id = r.zone_id
       WHERE z.warehouse_id = $1
         AND z.status = 'ACTIVE'
         AND r.status = 'ACTIVE'
         AND b.status IN ('EMPTY', 'PARTIAL')
         AND b.status NOT IN ('BLOCKED', 'RESERVED')
         AND (b.supported_box_type IS NULL OR b.supported_box_type = $2)
         AND GREATEST(0, b.max_lpn_count - COALESCE(b.current_lpn_count, 0)) >= 1
         AND GREATEST(0, b.max_volume_units - COALESCE(b.used_volume_units, 0)) >= $3`,
      [warehouseId, boxType, volumeUnits]
    );

    const row = result.rows[0] ?? {};
    const volumeBased = row.volume_based_boxes ?? 0;
    const lpnLimited = row.total_free_lpn_slots ?? 0;
    byType[boxType] = {
      candidateBins: row.candidate_bins ?? 0,
      estimatedBoxCapacity: volumeBased,
      totalFreeLpnSlots: lpnLimited,
      totalFreeVolumeUnits: row.total_free_volume_units ?? 0,
      volumeUnits,
      partialBinsCanAccept: partialFitByType[boxType]?.binsCanAcceptOneMore ?? 0,
      partialAdditionalLpn: partialFitByType[boxType]?.additionalLpnCapacity ?? 0,
    };
  }

  const suggestion = buildBoxTypeSuggestion(byType, partialFitByType);
  return {
    byType,
    partialFitByType,
    recommendedBoxType: suggestion.recommendedBoxType,
    recommendationReason: suggestion.reason,
    alternateNotes: suggestion.alternateNotes,
    recommendedVolumeUnits:
      BOX_VOLUME_UNITS[suggestion.recommendedBoxType] ?? DEFAULT_VOLUME_UNITS_PER_LPN,
  };
}

async function queryBinDiagnostics(warehouseId) {
  const result = await pool.query(
    `SELECT
       COUNT(*)::int AS bins_total,
       COUNT(*) FILTER (WHERE b.status IN ('EMPTY', 'PARTIAL'))::int AS bins_putaway_eligible,
       COUNT(*) FILTER (WHERE z.status = 'ACTIVE' AND r.status = 'ACTIVE')::int AS bins_active_layout,
       COUNT(*) FILTER (WHERE b.max_volume_units < $2)::int AS bins_below_standard_volume
     FROM bins b
     INNER JOIN rack_levels rl ON rl.rack_level_id = b.rack_level_id
     INNER JOIN racks r ON r.rack_id = rl.rack_id
     INNER JOIN warehouse_zones z ON z.zone_id = r.zone_id
     WHERE z.warehouse_id = $1`,
    [warehouseId, DEFAULT_BIN_MAX_VOLUME_UNITS]
  );
  return result.rows[0] ?? {};
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

/** Snapshot nhanh sức chứa putaway theo warehouse để hỗ trợ duyệt rental request. */
export async function getWarehouseCapacitySnapshot(warehouseId) {
  const whId = parseUuid(warehouseId, 'warehouseId');
  const [warehouseStorage, boxTypeCapacity, warehouseRow, binDiagnostics] = await Promise.all([
    queryWarehousePutawayCapacity(whId),
    queryBoxTypeCapacity(whId),
    pool.query(
      `SELECT usable_area_m2, total_area_m2 FROM warehouses WHERE warehouse_id = $1 LIMIT 1`,
      [whId]
    ),
    queryBinDiagnostics(whId),
  ]);
  const warehouse = warehouseRow.rows[0] ?? {};
  const usableAreaM2 = Number(warehouse.usable_area_m2 ?? warehouse.total_area_m2 ?? 0) || 0;
  const projectedStorageAreaM2 = usableAreaM2 > 0 ? usableAreaM2 * 0.7 : 0;
  const projectedRackCount = Math.floor(projectedStorageAreaM2 / 3);
  const projectedBinSlots = Math.floor(projectedStorageAreaM2 / 0.25);
  const projectedLpnCapacity = projectedBinSlots * DEFAULT_BIN_MAX_LPN_COUNT;

  let storage = { ...warehouseStorage };
  let boxByType = boxTypeCapacity.byType;
  let dataSource = 'actual';

  if ((storage.totalBins ?? 0) === 0 && projectedBinSlots > 0) {
    dataSource = 'projected';
    storage = {
      ...storage,
      isProjected: true,
      putawayEligibleBins: projectedBinSlots,
      emptyBins: projectedBinSlots,
      freeLpnSlots: projectedLpnCapacity,
      freeVolumeUnits: projectedBinSlots * DEFAULT_BIN_MAX_VOLUME_UNITS,
    };
    boxByType = buildProjectedBoxTypeCapacity(projectedBinSlots);
  }

  const suggestion = buildBoxTypeSuggestion(boxByType, boxTypeCapacity.partialFitByType ?? {});

  return {
    warehouseId: whId,
    usableAreaM2,
    dataSource,
    warehouseStorage: storage,
    boxTypeCapacity: boxByType,
    partialBinFitByType: boxTypeCapacity.partialFitByType,
    boxTypeSuggestion: {
      recommendedBoxType: suggestion.recommendedBoxType,
      reason: suggestion.reason,
      alternateNotes: suggestion.alternateNotes,
    },
    assumptions: {
      binMaxLpnCount: DEFAULT_BIN_MAX_LPN_COUNT,
      binMaxVolumeUnits: DEFAULT_BIN_MAX_VOLUME_UNITS,
    },
    projectedCapacity: {
      rackFootprintM2: 3,
      binFootprintM2: 0.25,
      aisleRatio: 0.3,
      projectedStorageAreaM2,
      projectedRackCount,
      projectedBinSlots,
      projectedLpnCapacity,
    },
    diagnostics: {
      binsTotal: binDiagnostics.bins_total ?? 0,
      binsPutawayEligible: binDiagnostics.bins_putaway_eligible ?? 0,
      binsActiveLayout: binDiagnostics.bins_active_layout ?? 0,
      binsBelowStandardVolume: binDiagnostics.bins_below_standard_volume ?? 0,
    },
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
