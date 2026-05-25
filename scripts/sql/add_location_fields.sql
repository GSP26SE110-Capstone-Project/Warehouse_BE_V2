-- City/district for warehouse region matching on rental requests.

ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS district VARCHAR(100);

ALTER TABLE rental_requests
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS district VARCHAR(100);

-- Guest submits by region; warehouse_id is set when a warehouse claims (approves) first.
ALTER TABLE rental_requests
  ALTER COLUMN warehouse_id DROP NOT NULL;

-- Backfill rental request region from assigned warehouse (legacy rows).
UPDATE rental_requests rr
SET
  city = COALESCE(rr.city, w.city),
  district = COALESCE(rr.district, w.district)
FROM warehouses w
WHERE rr.warehouse_id = w.warehouse_id
  AND (rr.city IS NULL OR rr.district IS NULL);

CREATE INDEX IF NOT EXISTS idx_warehouses_city_district ON warehouses (city, district);
CREATE INDEX IF NOT EXISTS idx_rental_requests_city_district ON rental_requests (city, district);
CREATE INDEX IF NOT EXISTS idx_rental_requests_unclaimed_region
  ON rental_requests (city, district, status)
  WHERE warehouse_id IS NULL;
