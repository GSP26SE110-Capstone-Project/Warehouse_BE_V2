-- Outbound delivery mode + outbound_deliveries (giao hàng ra sau SHIPPED)
-- Run: psql $DATABASE_URL -f scripts/sql/outbound_delivery_mode.sql

ALTER TABLE outbound_requests
  ADD COLUMN IF NOT EXISTS delivery_mode delivery_mode_enum DEFAULT 'TENANT_SELF';

DO $do$ BEGIN
  CREATE TYPE outbound_delivery_status_enum AS ENUM (
    'PENDING',
    'ASSIGNED',
    'IN_TRANSIT',
    'DELIVERED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $do$;

CREATE TABLE IF NOT EXISTS outbound_deliveries (
  outbound_delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_request_id UUID NOT NULL UNIQUE REFERENCES outbound_requests (outbound_request_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenant_companies (tenant_id),
  vehicle_plate VARCHAR(32),
  driver_name VARCHAR(255),
  driver_phone VARCHAR(50),
  driver_id_number VARCHAR(50),
  carrier_name VARCHAR(255),
  ship_to_address TEXT,
  ship_to_contact_name VARCHAR(255),
  ship_to_contact_phone VARCHAR(50),
  ship_to_notes TEXT,
  assigned_driver_user_id UUID REFERENCES users (user_id) ON DELETE SET NULL,
  delivery_status outbound_delivery_status_enum DEFAULT 'PENDING',
  actual_pickup_at TIMESTAMPTZ,
  actual_delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbound_deliveries_tenant_id ON outbound_deliveries (tenant_id);
CREATE INDEX IF NOT EXISTS idx_outbound_deliveries_assigned_driver ON outbound_deliveries (assigned_driver_user_id);
CREATE INDEX IF NOT EXISTS idx_outbound_deliveries_status ON outbound_deliveries (delivery_status);
