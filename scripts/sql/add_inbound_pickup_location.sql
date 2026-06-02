-- Điểm lấy hàng (tenant) cho chuyến WAREHOUSE_TRANSPORT
-- Run: docker exec -i smart_warehouse_db psql -U warehouse_admin -d smart_warehouse -f -

ALTER TABLE inbound_deliveries
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS pickup_contact_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pickup_contact_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pickup_notes TEXT;
