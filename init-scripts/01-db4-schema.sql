-- ======================================================
-- Warehouse BE V2 — full schema from docs/db4.md
-- PostgreSQL 15+ (synced with scripts/sql/db4_schema.sql)
--
-- After first boot, run location catalog seed:
--   npm run seed:locations
-- ======================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- ENUMS ----------
DO $do$ BEGIN CREATE TYPE role_enum AS ENUM ('SYSTEM_ADMIN','WH_ADMIN','WH_STAFF','WH_TRANSPORTER','TENANT_ADMIN','TENANT_STAFF'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE user_status_enum AS ENUM ('ACTIVE','INACTIVE','SUSPENDED','BLOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE tenant_status_enum AS ENUM ('ACTIVE','SUSPENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE warehouse_status_enum AS ENUM ('ACTIVE','INACTIVE','MAINTENANCE','CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE zone_type_enum AS ENUM ('SHARED','FAST_MOVING','PREMIUM','PRIVATE'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE zone_status_enum AS ENUM ('ACTIVE','BLOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE rack_type_enum AS ENUM ('STANDARD'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE rack_status_enum AS ENUM ('ACTIVE','BLOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE bin_status_enum AS ENUM ('EMPTY','PARTIAL','FULL','RESERVED','BLOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE contract_type_enum AS ENUM ('SHARED_STORAGE','RESERVED_STORAGE','DEDICATED_ZONE','DEDICATED_WAREHOUSE','NEEDS_CONSULTATION'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE pricing_model_enum AS ENUM ('USAGE_BASED','FIXED','HYBRID'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE billing_cycle_enum AS ENUM ('DAILY','MONTHLY','QUARTERLY','YEARLY'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE billing_unit_enum AS ENUM ('BOX_DAY','BIN_DAY','RACK_DAY','ZONE_DAY','WAREHOUSE_DAY','INBOUND_LPN','OUTBOUND_LPN','HANDLING_UNIT'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE contract_status_enum AS ENUM ('DRAFT','PENDING_APPROVAL','ACTIVE','EXPIRED','TERMINATED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE reservation_type_enum AS ENUM ('SHARED','RESERVED','DEDICATED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE reservation_status_enum AS ENUM ('ACTIVE','EXPIRED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE storage_level_enum AS ENUM ('WAREHOUSE','ZONE','RACK','RACK_LEVEL','BIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE rental_request_status_enum AS ENUM ('PENDING','UNDER_REVIEW','APPROVED','REJECTED','CONVERTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE box_type_enum AS ENUM ('SMALL','MEDIUM','LARGE','EXTRA'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE movement_category_enum AS ENUM ('FAST','NORMAL','SLOW'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE sku_status_enum AS ENUM ('ACTIVE','INACTIVE'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE inbound_status_enum AS ENUM ('DRAFT','PENDING','APPROVED','ARRIVED','RECEIVING','COMPLETED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE delivery_mode_enum AS ENUM ('TENANT_SELF','WAREHOUSE_TRANSPORT'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE lpn_status_enum AS ENUM ('RECEIVING','STORED','PICKED','SHIPPED','DAMAGED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE inventory_status_enum AS ENUM ('AVAILABLE','RESERVED','PICKED','DAMAGED','IN_TRANSIT','SHIPPED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE movement_type_enum AS ENUM ('INBOUND','PUTAWAY','RELOCATION','PICKING','OUTBOUND','SHIPPING','ADJUSTMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE outbound_status_enum AS ENUM ('DRAFT','PENDING','APPROVED','RESERVED','PICKING','PACKING','SHIPPED','COMPLETED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE picking_task_status_enum AS ENUM ('PENDING','PICKING','COMPLETED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE shipment_status_enum AS ENUM ('READY','SHIPPED','DELIVERED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE invoice_payment_status_enum AS ENUM ('PENDING','PAID','OVERDUE','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE invoice_item_type_enum AS ENUM ('STORAGE','INBOUND','OUTBOUND','HANDLING','REPACKING','SLA'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE payment_method_enum AS ENUM ('BANK_TRANSFER','CASH','E_WALLET'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN CREATE TYPE payment_status_enum AS ENUM ('PENDING','SUCCESS','FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- ---------- AUTH & ORGANIZATION ----------
CREATE TABLE IF NOT EXISTS tenant_companies (
  tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL,
  company_code VARCHAR(100) UNIQUE,
  tax_code VARCHAR(100) UNIQUE,
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  address TEXT,
  status tenant_status_enum DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_companies_status ON tenant_companies (status);

CREATE TABLE IF NOT EXISTS warehouses (
  warehouse_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_code VARCHAR(100) NOT NULL UNIQUE,
  warehouse_name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  district VARCHAR(100),
  total_area_m2 NUMERIC(18, 4),
  usable_area_m2 NUMERIC(18, 4),
  status warehouse_status_enum DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_city_district ON warehouses (city, district);

-- Location catalog for guest rental form (rental_requests.city/district are VARCHAR, no FK)
CREATE TABLE IF NOT EXISTS cities (
  city_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_code VARCHAR(20) NOT NULL UNIQUE,
  city_name VARCHAR(100) NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS districts (
  district_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities (city_id) ON DELETE CASCADE,
  district_name VARCHAR(100) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (city_id, district_name)
);

CREATE INDEX IF NOT EXISTS idx_districts_city_id ON districts (city_id);

CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenant_companies (tenant_id),
  warehouse_id UUID REFERENCES warehouses (warehouse_id),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role role_enum NOT NULL,
  status user_status_enum DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_warehouse_id ON users (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- ---------- WAREHOUSE STRUCTURE ----------
CREATE TABLE IF NOT EXISTS warehouse_zones (
  zone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses (warehouse_id),
  zone_code VARCHAR(100) NOT NULL,
  zone_name VARCHAR(255),
  zone_type zone_type_enum DEFAULT 'SHARED',
  area_m2 NUMERIC(18, 4),
  is_dedicated BOOLEAN DEFAULT FALSE,
  status zone_status_enum DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (warehouse_id, zone_code)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_zones_status ON warehouse_zones (status);

CREATE TABLE IF NOT EXISTS racks (
  rack_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES warehouse_zones (zone_id),
  rack_code VARCHAR(100) NOT NULL,
  rack_type rack_type_enum DEFAULT 'STANDARD',
  max_levels INT,
  status rack_status_enum DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (zone_id, rack_code)
);

CREATE INDEX IF NOT EXISTS idx_racks_status ON racks (status);

CREATE TABLE IF NOT EXISTS rack_levels (
  rack_level_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rack_id UUID NOT NULL REFERENCES racks (rack_id),
  level_code VARCHAR(50),
  level_number INT NOT NULL,
  max_bins INT,
  max_weight_kg NUMERIC(18, 4),
  height_cm NUMERIC(18, 4),
  level_priority INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (rack_id, level_number)
);

CREATE TABLE IF NOT EXISTS bins (
  bin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rack_level_id UUID NOT NULL REFERENCES rack_levels (rack_level_id),
  bin_code VARCHAR(100) NOT NULL,
  supported_box_type box_type_enum,
  max_lpn_count INT NOT NULL,
  current_lpn_count INT DEFAULT 0,
  max_volume_units INT NOT NULL,
  used_volume_units INT DEFAULT 0,
  max_owner_count INT DEFAULT 3,
  reservation_type reservation_type_enum DEFAULT 'SHARED',
  status bin_status_enum DEFAULT 'EMPTY',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (rack_level_id, bin_code)
);

CREATE INDEX IF NOT EXISTS idx_bins_status ON bins (status);
CREATE INDEX IF NOT EXISTS idx_bins_reservation_type ON bins (reservation_type);

-- ---------- RENTAL & CONTRACT ----------
CREATE TABLE IF NOT EXISTS rental_requests (
  rental_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code VARCHAR(100) NOT NULL UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenant_companies (tenant_id),
  city VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  warehouse_id UUID REFERENCES warehouses (warehouse_id),
  contract_type contract_type_enum,
  pricing_model pricing_model_enum,
  billing_cycle billing_cycle_enum,
  estimated_sku_count INT,
  estimated_box_count INT,
  estimated_volume NUMERIC(18, 4),
  requested_area_m2 NUMERIC(18, 4),
  average_storage_days INT,
  estimated_inbound_per_week INT,
  estimated_outbound_per_week INT,
  requires_fast_picking BOOLEAN DEFAULT FALSE,
  requires_premium_storage BOOLEAN DEFAULT FALSE,
  notes TEXT,
  suggested_zone_type zone_type_enum,
  suggested_rack_type rack_type_enum,
  expected_start_date TIMESTAMPTZ,
  expected_end_date TIMESTAMPTZ,
  status rental_request_status_enum DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES users (user_id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  review_note TEXT,
  created_by UUID REFERENCES users (user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_requests_warehouse_id ON rental_requests (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_rental_requests_tenant_id ON rental_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_rental_requests_city_district ON rental_requests (city, district);
CREATE INDEX IF NOT EXISTS idx_rental_requests_unclaimed_region
  ON rental_requests (city, district, status)
  WHERE warehouse_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_rental_requests_status ON rental_requests (status);
CREATE INDEX IF NOT EXISTS idx_rental_requests_contract_type ON rental_requests (contract_type);
CREATE INDEX IF NOT EXISTS idx_rental_requests_pricing_model ON rental_requests (pricing_model);
CREATE INDEX IF NOT EXISTS idx_rental_requests_suggested_zone_type ON rental_requests (suggested_zone_type);
CREATE INDEX IF NOT EXISTS idx_rental_requests_suggested_rack_type ON rental_requests (suggested_rack_type);

CREATE TABLE IF NOT EXISTS contracts (
  contract_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_companies (tenant_id),
  warehouse_id UUID NOT NULL REFERENCES warehouses (warehouse_id),
  rental_request_id UUID UNIQUE REFERENCES rental_requests (rental_request_id),
  contract_code VARCHAR(100) NOT NULL UNIQUE,
  contract_name VARCHAR(255),
  contract_type contract_type_enum NOT NULL,
  pricing_model pricing_model_enum NOT NULL,
  billing_cycle billing_cycle_enum DEFAULT 'MONTHLY',
  allow_dynamic_relocation BOOLEAN DEFAULT TRUE,
  auto_renew BOOLEAN DEFAULT FALSE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  minimum_billing_days INT DEFAULT 1,
  minimum_reserved_capacity NUMERIC(18, 4),
  estimated_total_amount NUMERIC(18, 4),
  status contract_status_enum DEFAULT 'DRAFT',
  tenant_signature TEXT,
  warehouse_signature TEXT,
  created_by UUID REFERENCES users (user_id),
  approved_by UUID REFERENCES users (user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_tenant_id ON contracts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_warehouse_id ON contracts (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_contracts_rental_request_id ON contracts (rental_request_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts (status);

CREATE TABLE IF NOT EXISTS contract_items (
  contract_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts (contract_id) ON DELETE CASCADE,
  item_type invoice_item_type_enum NOT NULL,
  storage_level storage_level_enum,
  billing_unit billing_unit_enum NOT NULL,
  quantity NUMERIC(18, 4),
  reserved_quantity INT,
  box_type box_type_enum,
  unit_price NUMERIC(18, 4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS storage_reservations (
  reservation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts (contract_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenant_companies (tenant_id),
  reservation_type reservation_type_enum NOT NULL,
  storage_level storage_level_enum NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses (warehouse_id),
  zone_id UUID REFERENCES warehouse_zones (zone_id),
  rack_id UUID REFERENCES racks (rack_id),
  rack_level_id UUID REFERENCES rack_levels (rack_level_id),
  bin_id UUID REFERENCES bins (bin_id),
  reserved_capacity NUMERIC(18, 4),
  box_type box_type_enum,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status reservation_status_enum DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_reservations_tenant_id ON storage_reservations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_storage_reservations_contract_id ON storage_reservations (contract_id);
CREATE INDEX IF NOT EXISTS idx_storage_reservations_storage_level ON storage_reservations (storage_level);
CREATE INDEX IF NOT EXISTS idx_storage_reservations_warehouse_id ON storage_reservations (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_storage_reservations_zone_id ON storage_reservations (zone_id);
CREATE INDEX IF NOT EXISTS idx_storage_reservations_rack_id ON storage_reservations (rack_id);
CREATE INDEX IF NOT EXISTS idx_storage_reservations_rack_level_id ON storage_reservations (rack_level_id);
CREATE INDEX IF NOT EXISTS idx_storage_reservations_bin_id ON storage_reservations (bin_id);
CREATE INDEX IF NOT EXISTS idx_storage_reservations_status ON storage_reservations (status);

-- ---------- PRODUCT / SKU ----------
CREATE TABLE IF NOT EXISTS categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS collections (
  collection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_companies (tenant_id),
  collection_name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS seasons (
  season_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS skus (
  sku_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_companies (tenant_id),
  sku_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  category_id UUID REFERENCES categories (category_id),
  collection_id UUID REFERENCES collections (collection_id),
  season_id UUID REFERENCES seasons (season_id),
  color VARCHAR(100),
  size VARCHAR(50),
  material VARCHAR(255),
  movement_category movement_category_enum DEFAULT 'NORMAL',
  status sku_status_enum DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, sku_code)
);

CREATE INDEX IF NOT EXISTS idx_skus_category_id ON skus (category_id);
CREATE INDEX IF NOT EXISTS idx_skus_collection_id ON skus (collection_id);
CREATE INDEX IF NOT EXISTS idx_skus_season_id ON skus (season_id);

-- ---------- INBOUND ----------
CREATE TABLE IF NOT EXISTS inbound_requests (
  inbound_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_companies (tenant_id),
  contract_id UUID NOT NULL REFERENCES contracts (contract_id),
  warehouse_id UUID NOT NULL REFERENCES warehouses (warehouse_id),
  inbound_code VARCHAR(100) NOT NULL UNIQUE,
  delivery_mode delivery_mode_enum DEFAULT 'TENANT_SELF',
  expected_arrival_date TIMESTAMPTZ,
  actual_arrival_at TIMESTAMPTZ,
  status inbound_status_enum DEFAULT 'PENDING',
  created_by UUID REFERENCES users (user_id),
  approved_by UUID REFERENCES users (user_id),
  received_by UUID REFERENCES users (user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_requests_tenant_id ON inbound_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inbound_requests_contract_id ON inbound_requests (contract_id);
CREATE INDEX IF NOT EXISTS idx_inbound_requests_warehouse_id ON inbound_requests (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inbound_requests_status ON inbound_requests (status);

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
  assigned_driver_user_id UUID REFERENCES users (user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_deliveries_tenant_id ON inbound_deliveries (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inbound_deliveries_assigned_driver ON inbound_deliveries (assigned_driver_user_id);
CREATE INDEX IF NOT EXISTS idx_inbound_deliveries_vehicle_plate ON inbound_deliveries (vehicle_plate);

CREATE TABLE IF NOT EXISTS inbound_request_items (
  inbound_request_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_request_id UUID NOT NULL REFERENCES inbound_requests (inbound_request_id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES skus (sku_id),
  expected_quantity INT NOT NULL,
  received_quantity INT DEFAULT 0,
  discrepancy_quantity INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_request_items_inbound_request_id ON inbound_request_items (inbound_request_id);
CREATE INDEX IF NOT EXISTS idx_inbound_request_items_sku_id ON inbound_request_items (sku_id);

CREATE TABLE IF NOT EXISTS batches (
  batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_request_id UUID NOT NULL REFERENCES inbound_requests (inbound_request_id) ON DELETE CASCADE,
  batch_code VARCHAR(100) NOT NULL UNIQUE,
  warehouse_received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_inbound_request_id ON batches (inbound_request_id);
CREATE INDEX IF NOT EXISTS idx_batches_warehouse_received_at ON batches (warehouse_received_at);

-- ---------- LPN ----------
CREATE TABLE IF NOT EXISTS lpns (
  lpn_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_companies (tenant_id),
  batch_id UUID NOT NULL REFERENCES batches (batch_id),
  lpn_code VARCHAR(100) NOT NULL UNIQUE,
  box_type box_type_enum NOT NULL,
  volume_units INT NOT NULL,
  max_capacity INT,
  actual_quantity INT DEFAULT 0,
  fill_percentage NUMERIC(8, 4),
  weight_kg NUMERIC(18, 4),
  current_bin_id UUID REFERENCES bins (bin_id),
  status lpn_status_enum DEFAULT 'RECEIVING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lpns_tenant_id ON lpns (tenant_id);
CREATE INDEX IF NOT EXISTS idx_lpns_batch_id ON lpns (batch_id);
CREATE INDEX IF NOT EXISTS idx_lpns_current_bin_id ON lpns (current_bin_id);
CREATE INDEX IF NOT EXISTS idx_lpns_status ON lpns (status);
CREATE INDEX IF NOT EXISTS idx_lpns_box_type ON lpns (box_type);

CREATE TABLE IF NOT EXISTS lpn_details (
  lpn_detail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lpn_id UUID NOT NULL REFERENCES lpns (lpn_id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES skus (sku_id),
  quantity INT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lpn_details_lpn_id ON lpn_details (lpn_id);
CREATE INDEX IF NOT EXISTS idx_lpn_details_sku_id ON lpn_details (sku_id);

-- ---------- INVENTORY ----------
CREATE TABLE IF NOT EXISTS inventories (
  inventory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_companies (tenant_id),
  sku_id UUID NOT NULL REFERENCES skus (sku_id),
  batch_id UUID NOT NULL REFERENCES batches (batch_id),
  lpn_id UUID NOT NULL REFERENCES lpns (lpn_id),
  bin_id UUID NOT NULL REFERENCES bins (bin_id),
  quantity INT NOT NULL,
  reserved_quantity INT DEFAULT 0,
  available_quantity INT DEFAULT 0,
  status inventory_status_enum DEFAULT 'AVAILABLE',
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventories_tenant_id ON inventories (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventories_sku_id ON inventories (sku_id);
CREATE INDEX IF NOT EXISTS idx_inventories_batch_id ON inventories (batch_id);
CREATE INDEX IF NOT EXISTS idx_inventories_lpn_id ON inventories (lpn_id);
CREATE INDEX IF NOT EXISTS idx_inventories_bin_id ON inventories (bin_id);
CREATE INDEX IF NOT EXISTS idx_inventories_status ON inventories (status);
CREATE INDEX IF NOT EXISTS idx_inventories_tenant_sku_status ON inventories (tenant_id, sku_id, status);

CREATE TABLE IF NOT EXISTS inventory_movements (
  movement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES inventories (inventory_id) ON DELETE CASCADE,
  movement_type movement_type_enum NOT NULL,
  from_bin_id UUID REFERENCES bins (bin_id),
  to_bin_id UUID REFERENCES bins (bin_id),
  quantity INT NOT NULL,
  moved_by UUID REFERENCES users (user_id),
  moved_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_inventory_id ON inventory_movements (inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_movement_type ON inventory_movements (movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_moved_at ON inventory_movements (moved_at);

-- ---------- OUTBOUND ----------
CREATE TABLE IF NOT EXISTS outbound_requests (
  outbound_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_companies (tenant_id),
  contract_id UUID NOT NULL REFERENCES contracts (contract_id),
  warehouse_id UUID NOT NULL REFERENCES warehouses (warehouse_id),
  outbound_code VARCHAR(100) NOT NULL UNIQUE,
  requested_ship_date TIMESTAMPTZ,
  actual_shipped_at TIMESTAMPTZ,
  status outbound_status_enum DEFAULT 'PENDING',
  created_by UUID REFERENCES users (user_id),
  approved_by UUID REFERENCES users (user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbound_requests_tenant_id ON outbound_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_outbound_requests_contract_id ON outbound_requests (contract_id);
CREATE INDEX IF NOT EXISTS idx_outbound_requests_warehouse_id ON outbound_requests (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_outbound_requests_status ON outbound_requests (status);

CREATE TABLE IF NOT EXISTS outbound_request_items (
  outbound_request_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_request_id UUID NOT NULL REFERENCES outbound_requests (outbound_request_id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES skus (sku_id),
  requested_quantity INT NOT NULL,
  allocated_quantity INT DEFAULT 0,
  picked_quantity INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_outbound_request_items_outbound_request_id ON outbound_request_items (outbound_request_id);
CREATE INDEX IF NOT EXISTS idx_outbound_request_items_sku_id ON outbound_request_items (sku_id);

CREATE TABLE IF NOT EXISTS picking_tasks (
  picking_task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_request_id UUID NOT NULL REFERENCES outbound_requests (outbound_request_id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users (user_id),
  status picking_task_status_enum DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_picking_tasks_outbound_request_id ON picking_tasks (outbound_request_id);
CREATE INDEX IF NOT EXISTS idx_picking_tasks_assigned_to ON picking_tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_picking_tasks_status ON picking_tasks (status);

CREATE TABLE IF NOT EXISTS picking_task_items (
  picking_task_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  picking_task_id UUID NOT NULL REFERENCES picking_tasks (picking_task_id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES inventories (inventory_id),
  lpn_id UUID NOT NULL REFERENCES lpns (lpn_id),
  bin_id UUID NOT NULL REFERENCES bins (bin_id),
  batch_id UUID NOT NULL REFERENCES batches (batch_id),
  quantity_to_pick INT NOT NULL,
  picked_quantity INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_picking_task_items_picking_task_id ON picking_task_items (picking_task_id);
CREATE INDEX IF NOT EXISTS idx_picking_task_items_inventory_id ON picking_task_items (inventory_id);
CREATE INDEX IF NOT EXISTS idx_picking_task_items_lpn_id ON picking_task_items (lpn_id);
CREATE INDEX IF NOT EXISTS idx_picking_task_items_bin_id ON picking_task_items (bin_id);
CREATE INDEX IF NOT EXISTS idx_picking_task_items_batch_id ON picking_task_items (batch_id);

CREATE TABLE IF NOT EXISTS shipments (
  shipment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_companies (tenant_id),
  outbound_request_id UUID NOT NULL REFERENCES outbound_requests (outbound_request_id) ON DELETE CASCADE,
  shipment_code VARCHAR(100) UNIQUE,
  carrier_name VARCHAR(255),
  tracking_number VARCHAR(255),
  vehicle_plate VARCHAR(32),
  driver_name VARCHAR(255),
  driver_phone VARCHAR(50),
  driver_id_number VARCHAR(50),
  status shipment_status_enum DEFAULT 'READY',
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_tenant_id ON shipments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipments_outbound_request_id ON shipments (outbound_request_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments (status);

-- ---------- BILLING ----------
CREATE TABLE IF NOT EXISTS pricing_policies (
  pricing_policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouses (warehouse_id),
  contract_type contract_type_enum,
  storage_level storage_level_enum,
  billing_unit billing_unit_enum NOT NULL,
  box_type box_type_enum,
  price NUMERIC(18, 4) NOT NULL,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_policies_warehouse_id ON pricing_policies (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_pricing_policies_contract_type ON pricing_policies (contract_type);
CREATE INDEX IF NOT EXISTS idx_pricing_policies_billing_unit ON pricing_policies (billing_unit);
CREATE INDEX IF NOT EXISTS idx_pricing_policies_box_type ON pricing_policies (box_type);

CREATE TABLE IF NOT EXISTS storage_usage_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_companies (tenant_id),
  contract_id UUID NOT NULL REFERENCES contracts (contract_id),
  snapshot_date DATE NOT NULL,
  storage_level storage_level_enum,
  billing_unit billing_unit_enum NOT NULL,
  box_type box_type_enum,
  occupied_count INT NOT NULL,
  calculated_fee NUMERIC(18, 4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, contract_id, snapshot_date, billing_unit, box_type)
);

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_companies (tenant_id),
  contract_id UUID NOT NULL REFERENCES contracts (contract_id),
  invoice_code VARCHAR(100) NOT NULL UNIQUE,
  billing_start_date DATE NOT NULL,
  billing_end_date DATE NOT NULL,
  subtotal NUMERIC(18, 4),
  tax NUMERIC(18, 4),
  total_amount NUMERIC(18, 4),
  payment_status invoice_payment_status_enum DEFAULT 'PENDING',
  issued_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices (tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contract_id ON invoices (contract_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices (payment_status);

CREATE TABLE IF NOT EXISTS invoice_items (
  invoice_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices (invoice_id) ON DELETE CASCADE,
  item_type invoice_item_type_enum NOT NULL,
  description VARCHAR(500),
  reference_id UUID,
  quantity NUMERIC(18, 4) NOT NULL,
  unit_price NUMERIC(18, 4) NOT NULL,
  total_price NUMERIC(18, 4) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices (invoice_id) ON DELETE CASCADE,
  amount NUMERIC(18, 4) NOT NULL,
  payment_method payment_method_enum,
  payment_status payment_status_enum DEFAULT 'PENDING',
  transaction_code VARCHAR(255),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- AI / ANALYTICS ----------
CREATE TABLE IF NOT EXISTS ai_slot_recommendations (
  recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_request_id UUID REFERENCES inbound_requests (inbound_request_id),
  lpn_id UUID REFERENCES lpns (lpn_id),
  sku_id UUID REFERENCES skus (sku_id),
  recommended_zone_id UUID REFERENCES warehouse_zones (zone_id),
  recommended_bin_id UUID REFERENCES bins (bin_id),
  recommendation_score NUMERIC(10, 4),
  reason TEXT,
  is_applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS occupancy_snapshots (
  occupancy_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouses (warehouse_id),
  zone_id UUID REFERENCES warehouse_zones (zone_id),
  occupancy_rate NUMERIC(10, 4),
  available_capacity INT,
  snapshot_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_occupancy_snapshots_warehouse_id ON occupancy_snapshots (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_occupancy_snapshots_zone_id ON occupancy_snapshots (zone_id);
CREATE INDEX IF NOT EXISTS idx_occupancy_snapshots_snapshot_date ON occupancy_snapshots (snapshot_date);

CREATE TABLE IF NOT EXISTS sku_movement_analytics (
  analytics_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id UUID REFERENCES skus (sku_id),
  snapshot_date DATE,
  inbound_qty INT,
  outbound_qty INT,
  picking_count INT,
  average_storage_days NUMERIC(10, 2),
  turnover_score NUMERIC(10, 4),
  movement_category movement_category_enum,
  UNIQUE (sku_id, snapshot_date)
);
