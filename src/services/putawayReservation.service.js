import pool from '../config/db.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { getBin } from './bin.service.js';
import { getRackLevel } from './rackLevel.service.js';
import { getRack } from './rack.service.js';
import { getZone } from './warehouseZone.service.js';
import { reservationCoversLocation } from './aiSlotting/featureExtractors/tenantReservation.extractor.js';

export async function loadActiveReservationsForContract(contractId, warehouseId) {
  const cId = parseUuid(contractId, 'contractId');
  const wId = parseUuid(warehouseId, 'warehouseId');

  const result = await pool.query(
    `SELECT sr.reservation_id,
            sr.storage_level,
            sr.zone_id,
            sr.rack_id,
            sr.rack_level_id,
            sr.bin_id,
            sr.reservation_type,
            z.zone_code
     FROM storage_reservations sr
     LEFT JOIN warehouse_zones z ON z.zone_id = sr.zone_id
     WHERE sr.contract_id = $1
       AND sr.warehouse_id = $2
       AND sr.status = 'ACTIVE'
       AND sr.start_date <= CURRENT_DATE
       AND sr.end_date >= CURRENT_DATE`,
    [cId, wId]
  );

  return result.rows.map((row) => ({
    reservationId: row.reservation_id,
    storageLevel: row.storage_level,
    zoneId: row.zone_id,
    rackId: row.rack_id,
    rackLevelId: row.rack_level_id,
    binId: row.bin_id,
    reservationType: row.reservation_type,
    zoneCode: row.zone_code,
  }));
}

export async function resolveBinLocation(binId) {
  const id = parseUuid(binId, 'binId');
  const bin = await getBin(id);
  const level = await getRackLevel(bin.rackLevelId);
  const rack = await getRack(level.rackId);
  const zone = await getZone(rack.zoneId);

  return {
    bin,
    binId: bin.binId,
    rackLevelId: level.rackLevelId,
    rackId: rack.rackId,
    zoneId: rack.zoneId,
    warehouseId: zone.warehouseId,
    zoneCode: zone.zoneCode,
    rackCode: rack.rackCode,
    levelNumber: level.levelNumber,
  };
}

function formatAllowedZonesHint(reservations) {
  const codes = [
    ...new Set(
      reservations
        .map((r) => {
          if (r.storageLevel === 'WAREHOUSE') return 'toàn kho';
          return r.zoneCode;
        })
        .filter(Boolean)
    ),
  ];
  return codes.length ? codes.join(', ') : 'theo HĐ';
}

export async function assertPutawayBinAllowed({ contractId, warehouseId, binId }) {
  const reservations = await loadActiveReservationsForContract(contractId, warehouseId);

  if (!reservations.length) {
    throw new AppError(
      'Hợp đồng chưa có phân bổ kho (storage reservation). Liên hệ WH Admin trước khi putaway.',
      400,
      'NO_STORAGE_RESERVATION'
    );
  }

  const location = await resolveBinLocation(binId);

  if (location.warehouseId !== parseUuid(warehouseId, 'warehouseId')) {
    throw new AppError('Bin không thuộc kho của phiếu nhập', 400, 'VALIDATION_ERROR');
  }

  const matches = reservations.some((r) => reservationCoversLocation(r, location));
  if (!matches) {
    throw new AppError(
      `Vị trí putaway không nằm trong phạm vi hợp đồng. Zone/vị trí được cấp: ${formatAllowedZonesHint(reservations)}.`,
      400,
      'PUTAWAY_OUT_OF_CONTRACT'
    );
  }

  const status = location.bin.status;
  if (status === 'BLOCKED' || status === 'FULL') {
    throw new AppError(`Bin ${location.bin.binCode} không nhận putaway (${status})`, 400, 'BIN_NOT_AVAILABLE');
  }

  const maxLpn = Number(location.bin.maxLpnCount ?? 0);
  const curLpn = Number(location.bin.currentLpnCount ?? 0);
  if (maxLpn > 0 && curLpn >= maxLpn) {
    throw new AppError(
      `Bin ${location.bin.binCode} đã đầy LPN (${curLpn}/${maxLpn}). Chọn bin hoặc tầng khác.`,
      400,
      'BIN_AT_CAPACITY'
    );
  }

  return location;
}

export async function loadPutawayEligibleBins({
  warehouseId,
  zoneId,
  rackLevelId,
}) {
  const wId = parseUuid(warehouseId, 'warehouseId');
  const zId = parseUuid(zoneId, 'zoneId');

  const params = [wId, zId];
  let levelClause = '';
  if (rackLevelId) {
    params.push(parseUuid(rackLevelId, 'rackLevelId'));
    levelClause = ` AND b.rack_level_id = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT b.bin_id,
            b.bin_code,
            b.rack_level_id,
            b.max_lpn_count,
            b.current_lpn_count,
            b.max_volume_units,
            b.used_volume_units,
            b.status,
            b.supported_box_type,
            r.rack_id,
            r.rack_code,
            z.zone_id,
            z.zone_code
     FROM bins b
     INNER JOIN rack_levels rl ON rl.rack_level_id = b.rack_level_id
     INNER JOIN racks r ON r.rack_id = rl.rack_id
     INNER JOIN warehouse_zones z ON z.zone_id = r.zone_id
     WHERE z.warehouse_id = $1
       AND z.zone_id = $2
       AND z.status = 'ACTIVE'
       AND r.status = 'ACTIVE'
       AND b.status IN ('EMPTY', 'PARTIAL')
       ${levelClause}
     ORDER BY r.rack_code ASC, rl.level_number ASC, b.bin_code ASC`,
    params
  );

  return result.rows.map((row) => ({
    binId: row.bin_id,
    binCode: row.bin_code,
    rackLevelId: row.rack_level_id,
    maxLpnCount: row.max_lpn_count,
    currentLpnCount: row.current_lpn_count,
    maxVolumeUnits: row.max_volume_units,
    usedVolumeUnits: row.used_volume_units,
    status: row.status,
    supportedBoxType: row.supported_box_type,
    rackId: row.rack_id,
    rackCode: row.rack_code,
    zoneId: row.zone_id,
    zoneCode: row.zone_code,
  }));
}

export function filterBinsByContract(bins, reservations) {
  if (!reservations.length) return [];
  return bins.filter((bin) =>
    reservations.some((r) =>
      reservationCoversLocation(r, {
        zoneId: bin.zoneId,
        rackId: bin.rackId,
        rackLevelId: bin.rackLevelId,
        binId: bin.binId,
      })
    )
  );
}

export function binFitsLpnVolume(bin, volumeUnits) {
  if (bin.status === 'BLOCKED' || bin.status === 'FULL') return false;
  const used = Number(bin.usedVolumeUnits ?? 0);
  const lpnCount = Number(bin.currentLpnCount ?? 0);
  const vol = Number(volumeUnits ?? 0);
  const maxVol = Number(bin.maxVolumeUnits ?? 0);
  const maxLpn = Number(bin.maxLpnCount ?? 0);
  if (maxVol > 0 && used + vol > maxVol) return false;
  if (maxLpn > 0 && lpnCount + 1 > maxLpn) return false;
  return true;
}

export function applyBinPutawayInMemory(bin, volumeUnits) {
  const vol = Number(volumeUnits ?? 0);
  bin.usedVolumeUnits = Number(bin.usedVolumeUnits ?? 0) + vol;
  bin.currentLpnCount = Number(bin.currentLpnCount ?? 0) + 1;
  const used = bin.usedVolumeUnits;
  const lpnCount = bin.currentLpnCount;
  if (
    used >= Number(bin.maxVolumeUnits ?? 0) ||
    lpnCount >= Number(bin.maxLpnCount ?? 0)
  ) {
    bin.status = 'FULL';
  } else {
    bin.status = 'PARTIAL';
  }
}
