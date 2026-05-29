-- WH_TRANSPORTER role + assign driver on inbound_deliveries
-- Run: psql $DATABASE_URL -f scripts/sql/add_wh_transporter.sql

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'role_enum'
      AND e.enumlabel = 'WH_TRANSPORTER'
  ) THEN
    ALTER TYPE role_enum ADD VALUE 'WH_TRANSPORTER';
  END IF;
END
$do$;

ALTER TABLE inbound_deliveries
  ADD COLUMN IF NOT EXISTS assigned_driver_user_id UUID REFERENCES users (user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inbound_deliveries_assigned_driver
  ON inbound_deliveries (assigned_driver_user_id);

ALTER TABLE inbound_deliveries
  ALTER COLUMN vehicle_plate DROP NOT NULL;
