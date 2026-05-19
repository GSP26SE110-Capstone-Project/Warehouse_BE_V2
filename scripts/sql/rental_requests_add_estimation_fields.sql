-- Align rental_requests with docs/db4.md (estimation, requirements, review, contract period).
--
-- Run: npm run db:migrate:rental-requests
-- Or:  node scripts/run-migration.mjs scripts/sql/rental_requests_add_estimation_fields.sql

BEGIN;

ALTER TABLE rental_requests
  ADD COLUMN IF NOT EXISTS estimated_sku_count INT,
  ADD COLUMN IF NOT EXISTS estimated_box_count INT,
  ADD COLUMN IF NOT EXISTS average_storage_days INT,
  ADD COLUMN IF NOT EXISTS estimated_inbound_per_week INT,
  ADD COLUMN IF NOT EXISTS estimated_outbound_per_week INT,
  ADD COLUMN IF NOT EXISTS requires_fast_picking BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_premium_storage BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suggested_zone_type zone_type_enum,
  ADD COLUMN IF NOT EXISTS suggested_rack_type rack_type_enum,
  ADD COLUMN IF NOT EXISTS expected_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_note TEXT;

CREATE INDEX IF NOT EXISTS idx_rental_requests_contract_type ON rental_requests (contract_type);
CREATE INDEX IF NOT EXISTS idx_rental_requests_pricing_model ON rental_requests (pricing_model);
CREATE INDEX IF NOT EXISTS idx_rental_requests_suggested_zone_type ON rental_requests (suggested_zone_type);
CREATE INDEX IF NOT EXISTS idx_rental_requests_suggested_rack_type ON rental_requests (suggested_rack_type);

COMMIT;
