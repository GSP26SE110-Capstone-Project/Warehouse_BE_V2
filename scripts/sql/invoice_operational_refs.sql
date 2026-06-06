-- Invoice operational refs + transport pickup region fields

DO $do$ BEGIN
  CREATE TYPE invoice_source_type_enum AS ENUM (
    'INBOUND_REQUEST',
    'OUTBOUND_REQUEST',
    'INBOUND_TRANSPORT',
    'OUTBOUND_TRANSPORT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS source_type invoice_source_type_enum,
  ADD COLUMN IF NOT EXISTS source_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_contract_source
  ON invoices (contract_id, source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

ALTER TABLE inbound_deliveries
  ADD COLUMN IF NOT EXISTS pickup_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pickup_district VARCHAR(100);

ALTER TABLE outbound_deliveries
  ADD COLUMN IF NOT EXISTS ship_to_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ship_to_district VARCHAR(100);

UPDATE contracts SET billing_cycle = 'MONTHLY' WHERE billing_cycle = 'YEARLY';
