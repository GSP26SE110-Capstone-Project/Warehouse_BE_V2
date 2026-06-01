import pool from '../config/db.js';
import { locationMatches } from '../utils/location.js';

export async function listLocationTree() {
  const result = await pool.query(
    `SELECT
       c.city_id,
       c.city_name,
       c.display_order AS city_order,
       d.district_id,
       d.district_name,
       d.display_order AS district_order
     FROM cities c
     LEFT JOIN districts d
       ON d.city_id = c.city_id
      AND d.is_active = TRUE
     WHERE c.is_active = TRUE
     ORDER BY c.display_order, c.city_name, d.display_order, d.district_name`
  );

  const byCity = new Map();

  for (const row of result.rows) {
    if (!byCity.has(row.city_id)) {
      byCity.set(row.city_id, {
        cityId: row.city_id,
        cityName: row.city_name,
        districts: [],
      });
    }
    if (row.district_id) {
      byCity.get(row.city_id).districts.push({
        districtId: row.district_id,
        districtName: row.district_name,
      });
    }
  }

  return { cities: [...byCity.values()] };
}

export async function isValidCityDistrict(cityName, districtName) {
  const city = String(cityName ?? '').trim();
  const district = String(districtName ?? '').trim();
  if (!city || !district) return false;

  const result = await pool.query(
    `SELECT 1
     FROM cities c
     INNER JOIN districts d ON d.city_id = c.city_id
     WHERE c.is_active = TRUE
       AND d.is_active = TRUE
       AND LOWER(TRIM(c.city_name)) = LOWER(TRIM($1))
       AND LOWER(TRIM(d.district_name)) = LOWER(TRIM($2))
     LIMIT 1`,
    [city, district]
  );

  return result.rowCount > 0;
}

/** Case-insensitive match against reference table; returns canonical city/district names. */
export async function resolveCityDistrict(cityName, districtName) {
  const result = await pool.query(
    `SELECT c.city_name, d.district_name
     FROM cities c
     INNER JOIN districts d ON d.city_id = c.city_id
     WHERE c.is_active = TRUE
       AND d.is_active = TRUE
       AND LOWER(TRIM(c.city_name)) = LOWER(TRIM($1))
       AND LOWER(TRIM(d.district_name)) = LOWER(TRIM($2))
     LIMIT 1`,
    [cityName, districtName]
  );

  if (result.rowCount === 0) return null;
  return {
    city: result.rows[0].city_name,
    district: result.rows[0].district_name,
  };
}

export function cityDistrictPairMatches(aCity, aDistrict, bCity, bDistrict) {
  return locationMatches(aCity, bCity) && locationMatches(aDistrict, bDistrict);
}

/** Public guest preview — ACTIVE warehouses in city/district (name + area + utilization). */
export async function listWarehousesInRegion(cityName, districtName) {
  const resolved = await resolveCityDistrict(cityName, districtName);
  if (!resolved) {
    return {
      count: 0,
      city: String(cityName ?? '').trim(),
      district: String(districtName ?? '').trim(),
      items: [],
    };
  }

  const result = await pool.query(
    `SELECT w.warehouse_name,
            w.total_area_m2,
            w.usable_area_m2,
            COALESCE(z.used_area_m2, 0) AS used_area_m2,
            COALESCE(leased.leased_area_m2, 0) AS leased_area_m2,
            EXISTS (
              SELECT 1
              FROM contracts c
              WHERE c.warehouse_id = w.warehouse_id
                AND c.status IN ('PENDING_APPROVAL', 'ACTIVE')
            ) AS has_active_tenant_contract,
            EXISTS (
              SELECT 1
              FROM contracts c
              WHERE c.warehouse_id = w.warehouse_id
                AND c.contract_type = 'DEDICATED_WAREHOUSE'
                AND c.status IN ('PENDING_APPROVAL', 'ACTIVE')
            ) AS has_dedicated_warehouse_lease
     FROM warehouses w
     LEFT JOIN (
       SELECT warehouse_id, SUM(area_m2) AS used_area_m2
       FROM warehouse_zones
       WHERE status = 'ACTIVE'
         AND area_m2 IS NOT NULL
       GROUP BY warehouse_id
     ) z ON z.warehouse_id = w.warehouse_id
     LEFT JOIN LATERAL (
       SELECT
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM contracts c
             WHERE c.warehouse_id = w.warehouse_id
               AND c.contract_type = 'DEDICATED_WAREHOUSE'
               AND c.status IN ('PENDING_APPROVAL', 'ACTIVE')
           ) THEN COALESCE(w.usable_area_m2, w.total_area_m2, 0)
           ELSE COALESCE((
             SELECT SUM(DISTINCT z2.area_m2)
             FROM storage_reservations sr
             INNER JOIN contracts c ON c.contract_id = sr.contract_id
             INNER JOIN warehouse_zones z2 ON z2.zone_id = sr.zone_id AND z2.status = 'ACTIVE'
             WHERE sr.warehouse_id = w.warehouse_id
               AND sr.status = 'ACTIVE'
               AND sr.storage_level = 'ZONE'
               AND c.status IN ('PENDING_APPROVAL', 'ACTIVE')
           ), 0)
         END AS leased_area_m2
     ) leased ON TRUE
     WHERE w.status = 'ACTIVE'
       AND w.city IS NOT NULL
       AND w.district IS NOT NULL
       AND LOWER(TRIM(w.city)) = LOWER(TRIM($1))
       AND LOWER(TRIM(w.district)) = LOWER(TRIM($2))
     ORDER BY w.warehouse_name ASC`,
    [resolved.city, resolved.district]
  );

  return {
    count: result.rowCount,
    city: resolved.city,
    district: resolved.district,
    items: result.rows.map((row) => mapGuestRegionWarehouseItem(row)),
  };
}

function deriveDedicatedLeaseAvailability(
  hasActiveTenantContract,
  hasDedicatedWarehouseLease,
  leasedPercent
) {
  if (hasDedicatedWarehouseLease || (leasedPercent != null && leasedPercent >= 100)) {
    return 'OCCUPIED';
  }
  if (hasActiveTenantContract) return 'OCCUPIED';
  if (leasedPercent != null && leasedPercent > 0) return 'NEEDS_REVIEW';
  return 'AVAILABLE';
}

function mapGuestRegionWarehouseItem(row) {
  const totalAreaM2 = row.total_area_m2 != null ? Number(row.total_area_m2) : null;
  const usableAreaM2 = row.usable_area_m2 != null ? Number(row.usable_area_m2) : null;
  const usedAreaM2 = Number(row.used_area_m2) || 0;
  const leasedAreaM2 = Number(row.leased_area_m2) || 0;
  const capacityAreaM2 = usableAreaM2 ?? totalAreaM2;
  const hasActiveTenantContract = Boolean(row.has_active_tenant_contract);
  const hasDedicatedWarehouseLease = Boolean(row.has_dedicated_warehouse_lease);
  let utilizationPercent = null;
  let availableAreaM2 = null;
  let leasedPercent = null;
  let unleasedAreaM2 = null;

  if (capacityAreaM2 != null && capacityAreaM2 > 0) {
    utilizationPercent = Math.min(100, Math.round((usedAreaM2 / capacityAreaM2) * 100));
    availableAreaM2 = Math.max(0, Math.round((capacityAreaM2 - usedAreaM2) * 10) / 10);
    leasedPercent = Math.min(100, Math.round((leasedAreaM2 / capacityAreaM2) * 100));
    unleasedAreaM2 = Math.max(0, Math.round((capacityAreaM2 - leasedAreaM2) * 10) / 10);
  }

  return {
    warehouseName: row.warehouse_name,
    totalAreaM2,
    usableAreaM2,
    capacityAreaM2,
    usedAreaM2,
    availableAreaM2,
    utilizationPercent,
    leasedAreaM2,
    leasedPercent,
    unleasedAreaM2,
    hasActiveTenantContract,
    hasDedicatedWarehouseLease,
    dedicatedLeaseAvailability: deriveDedicatedLeaseAvailability(
      hasActiveTenantContract,
      hasDedicatedWarehouseLease,
      leasedPercent
    ),
  };
}
