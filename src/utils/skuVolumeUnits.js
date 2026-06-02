import { BOX_VOLUME_UNITS } from '../constants/warehouseStructure.js';
import {
  allocateBoxesUpTo,
  allocationToArray,
  roundVolumeUnits,
  totalBoxCount,
} from './volumeUnitsAllocation.js';
import { getProductKind } from '../services/productKindCatalog.service.js';
import { resolveSizeGroup, getSizeFactorValue } from '../services/sizeFactorCatalog.service.js';

export const LEGACY_PIECES_PER_MEDIUM_LPN = 25;
export const LEGACY_VOLUME_UNITS_PER_LPN = 2;

function roundVolumeUnitsLocal(value) {
  return roundVolumeUnits(value);
}

/** U/cái theo productKind + size trên SKU (cùng luồng rental). */
export async function computeFinalVolumeUnitsPerPieceForSku(sku) {
  if (!sku?.productKind) return null;

  const kind = await getProductKind(sku.productKind);
  const baseU = Number(kind.baseVolumeUnitsPerPiece);
  if (!Number.isFinite(baseU) || baseU <= 0) return null;

  let sizeFactor = 1;
  if (kind.hasSize !== false) {
    const sizeText = sku.size != null ? String(sku.size).trim() : '';
    if (sizeText) {
      const sizeGroup = await resolveSizeGroup({
        size: sku.size,
        hasSize: true,
        fieldPrefix: 'sku',
      });
      sizeFactor = await getSizeFactorValue(sizeGroup);
    }
  }

  return roundVolumeUnitsLocal(baseU * sizeFactor);
}

export function computePiecesPerLpnFromFinalU(finalUPerPiece, boxType) {
  const boxVol = BOX_VOLUME_UNITS[boxType] ?? LEGACY_VOLUME_UNITS_PER_LPN;
  if (!finalUPerPiece || finalUPerPiece <= 0) {
    return Math.max(
      1,
      Math.round(LEGACY_PIECES_PER_MEDIUM_LPN * (boxVol / LEGACY_VOLUME_UNITS_PER_LPN))
    );
  }
  return Math.max(1, Math.floor(boxVol / finalUPerPiece));
}

/** Fallback cũ — scale theo box type khi thiếu catalog trên SKU. */
export function legacyPiecesPerLpnForBoxType(boxType) {
  const boxVol = BOX_VOLUME_UNITS[boxType] ?? LEGACY_VOLUME_UNITS_PER_LPN;
  return Math.max(
    1,
    Math.round(LEGACY_PIECES_PER_MEDIUM_LPN * (boxVol / LEGACY_VOLUME_UNITS_PER_LPN))
  );
}

/**
 * Phân bổ LPN theo tổng U — chỉ dùng loại thùng ≤ maxBoxType zone (vd. FAST_MOVING → tối đa Large).
 * Greedy: Large trước, phần dư ≤3U → Medium/Small (không cộng thêm theo số cái dư).
 */
function buildVolumeBasedBoxAllocation(totalU, _totalPieces, _avgUPerPiece, maxBoxType) {
  return allocationToArray(allocateBoxesUpTo(maxBoxType, totalU));
}

/**
 * Ước tính LPN/volume inbound: tổng U từng cái + phân bổ thùng cụ thể (Large + Small…).
 */
export async function computeInboundLpnEstimate(items, skusById, boxType) {
  const boxVol = BOX_VOLUME_UNITS[boxType] ?? LEGACY_VOLUME_UNITS_PER_LPN;
  let totalVolumeUnits = 0;
  let legacyPieceCount = 0;
  let totalPieces = 0;
  let weightedU = 0;

  for (const item of items ?? []) {
    const qty = Number(item.expectedQuantity ?? 0);
    if (qty <= 0) continue;
    totalPieces += qty;
    const sku = skusById.get(item.skuId) ?? skusById.get(String(item.skuId));
    const finalU = sku ? await computeFinalVolumeUnitsPerPieceForSku(sku) : null;
    if (finalU != null && finalU > 0) {
      totalVolumeUnits += qty * finalU;
      weightedU += finalU * qty;
    } else {
      legacyPieceCount += qty;
    }
  }

  totalVolumeUnits = roundVolumeUnitsLocal(totalVolumeUnits);
  const avgUPerPiece =
    totalPieces > 0 && weightedU > 0 ? roundVolumeUnitsLocal(weightedU / totalPieces) : 0;

  if (legacyPieceCount === 0 && totalPieces > 0 && totalVolumeUnits > 0) {
    const boxAllocation = buildVolumeBasedBoxAllocation(
      totalVolumeUnits,
      totalPieces,
      avgUPerPiece,
      boxType
    );
    const estimatedLpnNeeded = boxAllocation.reduce((s, row) => s + row.count, 0);
    return {
      estimatedLpnNeeded,
      estimatedVolumeUnitsNeeded: totalVolumeUnits,
      piecesPerLpn: Math.max(1, Math.round(totalPieces / estimatedLpnNeeded)),
      totalVolumeUnitsFromPieces: totalVolumeUnits,
      volumeBasedEstimate: true,
      boxAllocation,
      avgVolumeUnitsPerPiece: avgUPerPiece,
    };
  }

  if (legacyPieceCount > 0 && totalVolumeUnits > 0) {
    const catalogAlloc = buildVolumeBasedBoxAllocation(
      totalVolumeUnits,
      totalPieces - legacyPieceCount,
      avgUPerPiece,
      boxType
    );
    const legacyPiecesPerLpn = legacyPiecesPerLpnForBoxType(boxType);
    const legacyLpn = Math.ceil(legacyPieceCount / legacyPiecesPerLpn);
    const boxAllocation = [...catalogAlloc];
    const existing = boxAllocation.find((r) => r.boxType === boxType);
    if (existing) existing.count += legacyLpn;
    else boxAllocation.push({ boxType, count: legacyLpn });
    const estimatedLpnNeeded = boxAllocation.reduce((s, r) => s + r.count, 0);
    return {
      estimatedLpnNeeded,
      estimatedVolumeUnitsNeeded: roundVolumeUnitsLocal(
        totalVolumeUnits + legacyLpn * boxVol
      ),
      piecesPerLpn: Math.max(1, Math.round(totalPieces / estimatedLpnNeeded)),
      totalVolumeUnitsFromPieces: totalVolumeUnits,
      volumeBasedEstimate: true,
      boxAllocation,
      avgVolumeUnitsPerPiece: avgUPerPiece,
    };
  }

  const piecesPerLpn = legacyPiecesPerLpnForBoxType(boxType);
  const estimatedLpnNeeded =
    totalPieces > 0 ? Math.ceil(totalPieces / piecesPerLpn) : 0;
  return {
    estimatedLpnNeeded,
    estimatedVolumeUnitsNeeded: estimatedLpnNeeded * boxVol,
    piecesPerLpn,
    totalVolumeUnitsFromPieces: 0,
    volumeBasedEstimate: false,
    boxAllocation: estimatedLpnNeeded > 0 ? [{ boxType, count: estimatedLpnNeeded }] : [],
    avgVolumeUnitsPerPiece: 0,
  };
}

/** Trung bình có trọng số theo expectedQuantity (ước tính inbound). */
export async function computeWeightedPiecesPerLpn(items, skusById, boxType) {
  if (!items?.length) return legacyPiecesPerLpnForBoxType(boxType);

  let totalQty = 0;
  let weightedSum = 0;

  for (const item of items) {
    const qty = Number(item.expectedQuantity ?? 0);
    if (qty <= 0) continue;

    const sku = skusById.get(item.skuId) ?? skusById.get(String(item.skuId));
    const finalU = sku ? await computeFinalVolumeUnitsPerPieceForSku(sku) : null;
    const pieces = computePiecesPerLpnFromFinalU(finalU, boxType);

    weightedSum += pieces * qty;
    totalQty += qty;
  }

  if (totalQty <= 0) return legacyPiecesPerLpnForBoxType(boxType);
  return Math.max(1, Math.round(weightedSum / totalQty));
}
