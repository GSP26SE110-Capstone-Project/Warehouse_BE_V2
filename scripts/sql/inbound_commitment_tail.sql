-- Rental commitment tail close + inbound overage audit
-- Run: node scripts/run-migration.mjs scripts/sql/inbound_commitment_tail.sql

ALTER TABLE rental_request_product_lines
  ADD COLUMN IF NOT EXISTS written_off_pieces INT NOT NULL DEFAULT 0;

DO $do$ BEGIN
  ALTER TABLE rental_request_product_lines
    ADD CONSTRAINT rental_request_product_lines_written_off_check
    CHECK (written_off_pieces >= 0 AND written_off_pieces <= quantity);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $do$;

ALTER TABLE inbound_requests
  ADD COLUMN IF NOT EXISTS commitment_warning_json JSONB;
