-- WAREHOUSE_TRANSPORT: pickup at tenant → IN_TRANSIT → report-arrival at warehouse → ARRIVED

DO $do$ BEGIN
  ALTER TYPE inbound_status_enum ADD VALUE 'IN_TRANSIT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $do$;

ALTER TABLE inbound_deliveries
  ADD COLUMN IF NOT EXISTS actual_pickup_at TIMESTAMPTZ;
