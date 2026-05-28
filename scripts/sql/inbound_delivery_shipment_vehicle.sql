-- Inbound delivery (chuyến xe ĐẾN kho) + vehicle/driver on outbound shipments
-- Run: psql $DATABASE_URL -f scripts/sql/inbound_delivery_shipment_vehicle.sql

DO $do$ BEGIN
  CREATE TYPE delivery_mode_enum AS ENUM ('TENANT_SELF', 'WAREHOUSE_TRANSPORT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $do$;

ALTER TABLE inbound_requests
  ADD COLUMN IF NOT EXISTS delivery_mode delivery_mode_enum DEFAULT 'TENANT_SELF';

CREATE TABLE IF NOT EXISTS inbound_deliveries (
  inbound_delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_request_id UUID NOT NULL UNIQUE REFERENCES inbound_requests (inbound_request_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenant_companies (tenant_id),
  vehicle_plate VARCHAR(32) NOT NULL,
  driver_name VARCHAR(255),
  driver_phone VARCHAR(50),
  driver_id_number VARCHAR(50),
  carrier_name VARCHAR(255),
  scheduled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_deliveries_tenant_id ON inbound_deliveries (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inbound_deliveries_vehicle_plate ON inbound_deliveries (vehicle_plate);

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(32),
  ADD COLUMN IF NOT EXISTS driver_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS driver_id_number VARCHAR(50);
