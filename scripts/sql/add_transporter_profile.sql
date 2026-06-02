-- Hồ sơ xe mặc định cho WH_TRANSPORTER (tự cập nhật sau login)
-- Run: psql $DATABASE_URL -f scripts/sql/add_transporter_profile.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS default_vehicle_plate VARCHAR(32),
  ADD COLUMN IF NOT EXISTS default_driver_id_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS default_carrier_name VARCHAR(255);
