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

/** Public guest preview — ACTIVE warehouses in city/district (name + area only). */
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
    `SELECT warehouse_name, total_area_m2
     FROM warehouses
     WHERE status = 'ACTIVE'
       AND city IS NOT NULL
       AND district IS NOT NULL
       AND LOWER(TRIM(city)) = LOWER(TRIM($1))
       AND LOWER(TRIM(district)) = LOWER(TRIM($2))
     ORDER BY warehouse_name ASC`,
    [resolved.city, resolved.district]
  );

  return {
    count: result.rowCount,
    city: resolved.city,
    district: resolved.district,
    items: result.rows.map((row) => ({
      warehouseName: row.warehouse_name,
      totalAreaM2: row.total_area_m2 != null ? Number(row.total_area_m2) : null,
    })),
  };
}
