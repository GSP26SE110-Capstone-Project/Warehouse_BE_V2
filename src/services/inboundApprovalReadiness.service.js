import pool from '../config/db.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import Batch from '../models/Batch.js';
import InboundRequestItem from '../models/InboundRequestItem.js';
import { getInboundRequest } from './inboundRequest.service.js';

/** Giả định khi chưa biết cách đóng thùng thật (ước tính duyệt inbound). */
export const DEFAULT_PIECES_PER_LPN = 25;
export const DEFAULT_VOLUME_UNITS_PER_LPN = 2;

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
  const estimatedLpnNeeded =
    totalExpectedPieces > 0
      ? Math.ceil(totalExpectedPieces / DEFAULT_PIECES_PER_LPN)
      : 0;
  const estimatedVolumeUnitsNeeded = estimatedLpnNeeded * DEFAULT_VOLUME_UNITS_PER_LPN;

  const warehouseStorage = await queryWarehousePutawayCapacity(inbound.warehouseId);

  const sufficientLpnSlots = warehouseStorage.freeLpnSlots >= estimatedLpnNeeded;
  const sufficientVolume = warehouseStorage.freeVolumeUnits >= estimatedVolumeUnitsNeeded;
  const sufficient = sufficientLpnSlots && sufficientVolume;

  const warnings = [];
  if (items.length === 0) {
    warnings.push('Inbound chưa có dòng hàng — khó ước tính chỗ trống.');
  }
  if (!sufficientLpnSlots) {
    warnings.push(
      `Thiếu slot LPN: cần ~${estimatedLpnNeeded}, kho còn ${warehouseStorage.freeLpnSlots} slot trên bin EMPTY/PARTIAL.`
    );
  }
  if (!sufficientVolume) {
    warnings.push(
      `Thiếu volume: cần ~${estimatedVolumeUnitsNeeded} units (giả định thùng MEDIUM), kho còn ${warehouseStorage.freeVolumeUnits}.`
    );
  }
  if (warehouseStorage.putawayEligibleBins === 0) {
    warnings.push('Không có bin EMPTY/PARTIAL khả dụng trong kho.');
  }

  const batchCount = batches.length;
  const status = inbound.status;

  return {
    inboundRequestId: id,
    status,
    warehouseId: inbound.warehouseId,
    totalExpectedPieces,
    inboundLineCount: items.length,
    assumptions: {
      piecesPerLpn: DEFAULT_PIECES_PER_LPN,
      volumeUnitsPerLpn: DEFAULT_VOLUME_UNITS_PER_LPN,
      boxType: 'MEDIUM',
    },
    estimatedLpnNeeded,
    estimatedVolumeUnitsNeeded,
    warehouseStorage,
    sufficient,
    sufficientLpnSlots,
    sufficientVolume,
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
