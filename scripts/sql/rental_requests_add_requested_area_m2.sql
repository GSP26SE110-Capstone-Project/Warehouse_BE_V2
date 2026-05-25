ALTER TABLE rental_requests
  ADD COLUMN IF NOT EXISTS requested_area_m2 NUMERIC(18, 4);
