import pool from '../config/db.js';
import AppError from '../utils/AppError.js';
import {
  DEFAULT_HIGH_CAPACITY_WEIGHT_KG,
  RACK_TYPE,
} from '../constants/warehouseStructure.js';
import { parseUuid } from '../utils/validate.js';
import { getLpn } from './lpn.service.js';
import { getWarehouseById } from './warehouse.service.js';

function getHighCapacityThresholdKg() {
  const env = process.env.LPN_HIGH_CAPACITY_WEIGHT_KG;
  if (env == null || env === '') {
    return DEFAULT_HIGH_CAPACITY_WEIGHT_KG;
  }
  const n = Number(env);
  if (Number.isNaN(n) || n <= 0) {
    return DEFAULT_HIGH_CAPACITY_WEIGHT_KG;
  }
  return n;
}

export function suggestRackTypeFromWeight(weightKg) {
  const threshold = getHighCapacityThresholdKg();

  if (weightKg == null || weightKg === '') {
    return {
      suggestedRackType: 'STANDARD',
      weightKg: null,
      thresholdKg: threshold,
      reason: 'No weight recorded; default to STANDARD rack',
    };
  }

  const w = Number(weightKg);
  if (Number.isNaN(w) || w < 0) {
    throw new AppError('weightKg must be a non-negative number', 400, 'VALIDATION_ERROR');
  }

  if (w > threshold) {
    return {
      suggestedRackType: 'HIGH_CAPACITY',
      weightKg: w,
      thresholdKg: threshold,
      reason: `Weight ${w} kg exceeds ${threshold} kg standard limit`,
    };
  }

  return {
    suggestedRackType: 'STANDARD',
    weightKg: w,
    thresholdKg: threshold,
    reason: `Weight ${w} kg is within standard limit (≤ ${threshold} kg)`,
  };
}

function mapSuitableLevelRow(row) {
  return {
    rackLevelId: row.rack_level_id,
    levelCode: row.level_code,
    levelNumber: row.level_number,
    maxWeightKg: row.max_weight_kg != null ? Number(row.max_weight_kg) : null,
    rackId: row.rack_id,
    rackCode: row.rack_code,
    rackType: row.rack_type,
    zoneId: row.zone_id,
    zoneCode: row.zone_code,
  };
}

export async function suggestRackPlacementForLpn(lpnId, { warehouseId } = {}) {
  const lpn = await getLpn(lpnId);
  const rackTypeHint = suggestRackTypeFromWeight(lpn.weightKg);

  const result = {
    lpnId: lpn.lpnId,
    lpnCode: lpn.lpnCode,
    weightKg: lpn.weightKg != null ? Number(lpn.weightKg) : null,
    ...rackTypeHint,
    suitableRackLevels: [],
  };

  if (!warehouseId) {
    result.note =
      'Pass warehouseId query to list rack levels that support this weight and rack type';
    return result;
  }

  const whId = parseUuid(warehouseId, 'warehouseId');
  await getWarehouseById(whId);

  if (rackTypeHint.weightKg == null) {
    result.note = 'Record weightKg on LPN for level capacity filtering';
    return result;
  }

  const weight = rackTypeHint.weightKg;
  const rackType = rackTypeHint.suggestedRackType;

  if (!RACK_TYPE.includes(rackType)) {
    throw new AppError('Invalid suggested rack type', 500, 'INTERNAL_ERROR');
  }

  const levels = await pool.query(
    `SELECT rl.rack_level_id, rl.level_code, rl.level_number, rl.max_weight_kg,
            r.rack_id, r.rack_code, r.rack_type,
            z.zone_id, z.zone_code
     FROM rack_levels rl
     INNER JOIN racks r ON r.rack_id = rl.rack_id
     INNER JOIN warehouse_zones z ON z.zone_id = r.zone_id
     WHERE z.warehouse_id = $1
       AND r.status = 'ACTIVE'
       AND z.status = 'ACTIVE'
       AND r.rack_type = $2
       AND (rl.max_weight_kg IS NULL OR rl.max_weight_kg >= $3)
     ORDER BY rl.level_number ASC, r.rack_code ASC
     LIMIT 50`,
    [whId, rackType, weight]
  );

  result.suitableRackLevels = levels.rows.map(mapSuitableLevelRow);
  result.warehouseId = whId;

  return result;
}
