HỆ THỐNG KHO PHÂN PHỐI CÔNG CỘNG CHO DOANH NGHIỆP THỜI TRANG

1. GIỚI THIỆU HỆ THỐNG
1.1 Mô tả bài toán
Hệ thống được xây dựng nhằm hỗ trợ quản lý kho phân phối công cộng (Public Distribution Warehouse) dành cho nhiều doanh nghiệp thời trang cùng thuê không gian lưu trữ.
Các doanh nghiệp có thể:
Gửi hàng vào kho theo nhiều đợt
Theo dõi tồn kho
Yêu cầu xuất hàng
Nhận báo cáo tồn kho và nhập/xuất hàng
Hệ thống hỗ trợ:
Multi-tenant inventory management
FIFO inventory allocation
Shared warehouse space optimization
Container-based storage management
AI-assisted slot recommendation

2. MÔ HÌNH LƯU TRỮ
2.1 Warehouse Hierarchy
Warehouse
 → Zone
   → Rack
      → Rack Level
         → Bin
            → LPN
               → SKU



// =====================================================
// ENUMS
// =====================================================

Enum user_status_enum {
  ACTIVE
  INACTIVE
  BLOCKED
}

Enum tenant_status_enum {
  ACTIVE
  SUSPENDED
}

Enum warehouse_status_enum {
  ACTIVE
  MAINTENANCE
  CLOSED
}

Enum zone_type_enum {
  SHARED
  DEDICATED
  FAST_MOVING
  BULK
}

Enum zone_status_enum {
  ACTIVE
  BLOCKED
}

Enum rack_type_enum {
  STANDARD
  HIGH_CAPACITY
}

Enum rack_status_enum {
  ACTIVE
  BLOCKED
}

Enum bin_status_enum {
  AVAILABLE
  RESERVED
  OCCUPIED
  BLOCKED
}

Enum role_name_enum {
  SYSTEM_ADMIN
  WH_ADMIN
  WH_STAFF
  TENANT_ADMIN
  TENANT_STAFF
}

Enum box_type_enum {
  SMALL
  MEDIUM
  LARGE
  EXTRA
}

Enum sku_status_enum {
  ACTIVE
  INACTIVE
}

Enum contract_type_enum {
  SHARED_STORAGE
  RESERVED_STORAGE
  DEDICATED_ZONE
  DEDICATED_WAREHOUSE
}

Enum pricing_model_enum {
  USAGE_BASED
  FIXED
  HYBRID
}

Enum billing_cycle_enum {
  MONTHLY
  QUARTERLY
}

Enum contract_status_enum {
  DRAFT
  PENDING_APPROVAL
  ACTIVE
  EXPIRED
  TERMINATED
}

Enum item_type_enum {
  STORAGE
  HANDLING
  OUTBOUND
  SLA
}

Enum storage_level_enum {
  WAREHOUSE
  ZONE
  RACK
  RACK_LEVEL
  BIN
}

Enum billing_type_enum {
  FIXED
  USAGE_BASED
}

Enum reservation_type_enum {
  SHARED
  RESERVED
  DEDICATED
}

Enum reservation_status_enum {
  ACTIVE
  EXPIRED
  CANCELLED
}

Enum rental_request_status_enum {
  PENDING
  UNDER_REVIEW
  APPROVED
  REJECTED
  CONVERTED
}

Enum inbound_status_enum {
  DRAFT
  PENDING
  APPROVED
  RECEIVING
  COMPLETED
  CANCELLED
}

Enum lpn_status_enum {
  RECEIVING
  STORED
  PICKED
  SHIPPED
}

Enum inventory_status_enum {
  AVAILABLE
  RESERVED
  PICKED
  DAMAGED
  SHIPPED
}

Enum movement_type_enum {
  PUTAWAY
  RELOCATION
  PICKING
  SHIPPING
}

Enum outbound_status_enum {
  DRAFT
  PENDING
  APPROVED
  PICKING
  PACKED
  SHIPPED
  COMPLETED
}

Enum picking_task_status_enum {
  PENDING
  PICKING
  COMPLETED
}

Enum shipment_status_enum {
  READY
  SHIPPED
  DELIVERED
}

Enum pricing_method_enum {
  AREA_BASED
  FIXED
  OCCUPANCY_BASED
}

Enum pricing_unit_enum {
  M2
  RACK
  BOX_DAY
}

Enum invoice_payment_status_enum {
  PENDING
  PAID
  OVERDUE
}

Enum invoice_item_type_enum {
  STORAGE
  INBOUND
  OUTBOUND
  HANDLING
}

Enum payment_method_enum {
  BANK_TRANSFER
  CASH
  E_WALLET
}

Enum payment_status_enum {
  PENDING
  SUCCESS
  FAILED
}



// =====================================================
// AUTH & ORGANIZATION
// =====================================================

Table roles {
  role_id uuid [pk]
  role_name role_name_enum [unique]
}

Table users {
  user_id uuid [pk]

  full_name varchar
  email varchar [unique]
  password_hash varchar

  phone varchar

  tenant_id uuid [ref: > tenant_companies.tenant_id]
  warehouse_id uuid [ref: > warehouses.warehouse_id]

  status user_status_enum

  created_at timestamp
  updated_at timestamp
}

Table user_roles {
  user_role_id uuid [pk]

  user_id uuid [not null, ref: > users.user_id]
  role_id uuid [not null, ref: > roles.role_id]
}

Table tenant_companies {
  tenant_id uuid [pk]

  company_name varchar
  company_code varchar [unique]

  tax_code varchar
  address text

  contact_name varchar
  contact_phone varchar

  status tenant_status_enum

  created_at timestamp
}

Table warehouses {
  warehouse_id uuid [pk]

  warehouse_code varchar [unique]
  warehouse_name varchar

  address text

  total_area_m2 decimal

  status warehouse_status_enum

  created_at timestamp
}



// =====================================================
// WAREHOUSE STRUCTURE
// =====================================================

Table warehouse_zones {
  zone_id uuid [pk]

  warehouse_id uuid [not null, ref: > warehouses.warehouse_id]

  zone_code varchar
  zone_name varchar

  zone_type zone_type_enum

  area_m2 decimal

  status zone_status_enum

  created_at timestamp
}

Table racks {
  rack_id uuid [pk]

  zone_id uuid [not null, ref: > warehouse_zones.zone_id]

  rack_code varchar

  rack_type rack_type_enum

  status rack_status_enum

  created_at timestamp

  indexes {
    (zone_id, rack_code) [unique]
  }
}

Table rack_levels {
  rack_level_id uuid [pk]

  rack_id uuid [not null, ref: > racks.rack_id]

  level_number int

  max_bins int

  max_weight decimal

  height_cm decimal

  created_at timestamp

  indexes {
    (rack_id, level_number) [unique]
  }
}

Table bins {
  bin_id uuid [pk]

  rack_level_id uuid [not null, ref: > rack_levels.rack_level_id]

  bin_code varchar

  capacity_small decimal
  capacity_medium decimal
  capacity_large decimal
  capacity_extra decimal

  current_occupied_capacity decimal

  status bin_status_enum

  created_at timestamp

  indexes {
    (rack_level_id, bin_code) [unique]
  }
}

// =====================================================
// PRODUCT / SKU
// =====================================================

Table categories {
  category_id uuid [pk]

  category_name varchar
}

Table collections {
  collection_id uuid [pk]

  collection_name varchar
}

Table seasons {
  season_id uuid [pk]

  season_name varchar
}

Table skus {
  sku_id uuid [pk]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]

  sku_code varchar [unique]

  product_name varchar

  category_id uuid [ref: > categories.category_id]
  collection_id uuid [ref: > collections.collection_id]
  season_id uuid [ref: > seasons.season_id]

  color varchar
  size varchar
  material varchar

  box_type box_type_enum

  status sku_status_enum

  created_at timestamp
}



// =====================================================
// TENANT ONBOARDING
// =====================================================

Table rental_requests {
  rental_request_id uuid [pk]

  request_code varchar [unique]

  company_name varchar
  company_code varchar
  tax_code varchar
  address text

  contact_name varchar
  contact_phone varchar
  contact_email varchar

  warehouse_id uuid [not null, ref: > warehouses.warehouse_id]

  contract_type contract_type_enum
  pricing_model pricing_model_enum
  billing_cycle billing_cycle_enum

  requested_capacity decimal
  notes text

  status rental_request_status_enum

  reviewed_by uuid [ref: > users.user_id]
  reviewed_at timestamp
  rejection_reason text

  created_by uuid [ref: > users.user_id]

  created_at timestamp
  updated_at timestamp
}

// =====================================================
// CONTRACT
// =====================================================

Table contracts {
  contract_id uuid [pk]

  contract_code varchar [unique]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]
  warehouse_id uuid [not null, ref: > warehouses.warehouse_id]

  rental_request_id uuid [unique, ref: > rental_requests.rental_request_id]

  contract_name varchar

  contract_type contract_type_enum

  pricing_model pricing_model_enum

  start_date timestamp
  end_date timestamp

  billing_cycle billing_cycle_enum

  auto_renew boolean

  minimum_reserved_capacity decimal

  status contract_status_enum

  created_by uuid [ref: > users.user_id]
  approved_by uuid [ref: > users.user_id]

  tenant_signature text
  warehouse_signature text

  created_at timestamp
}

Table contract_items {
  contract_item_id uuid [pk]

  contract_id uuid [not null, ref: > contracts.contract_id]

  item_type item_type_enum

  storage_level storage_level_enum

  quantity decimal

  unit_price decimal

  billing_type billing_type_enum

  created_at timestamp
}

Table storage_reservations {
  reservation_id uuid [pk]

  contract_id uuid [not null, ref: > contracts.contract_id]
  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]

  reservation_type reservation_type_enum

  storage_level storage_level_enum

  warehouse_id uuid [ref: > warehouses.warehouse_id]
  zone_id uuid [ref: > warehouse_zones.zone_id]
  rack_id uuid [ref: > racks.rack_id]
  rack_level_id uuid [ref: > rack_levels.rack_level_id]
  bin_id uuid [ref: > bins.bin_id]

  reserved_capacity decimal

  start_date timestamp
  end_date timestamp

  status reservation_status_enum

  created_at timestamp
}



// =====================================================
// INBOUND
// =====================================================

Table inbound_requests {
  inbound_request_id uuid [pk]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]
  contract_id uuid [not null, ref: > contracts.contract_id]

  request_code varchar [unique]

  expected_arrival_date timestamp
  actual_arrival_date timestamp

  status inbound_status_enum

  created_by uuid [ref: > users.user_id]

  created_at timestamp
}

Table inbound_request_items {
  inbound_request_item_id uuid [pk]

  inbound_request_id uuid [not null, ref: > inbound_requests.inbound_request_id]

  sku_id uuid [not null, ref: > skus.sku_id]

  expected_quantity int
  received_quantity int
}



// =====================================================
// BATCH / LPN
// =====================================================

Table batches {
  batch_id uuid [pk]

  inbound_request_id uuid [ref: > inbound_requests.inbound_request_id]

  batch_code varchar

  received_date timestamp

  created_at timestamp
}

Table lpns {
  lpn_id uuid [pk]

  batch_id uuid [ref: > batches.batch_id]

  lpn_code varchar [unique]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]

  box_type box_type_enum

  current_bin_id uuid [ref: > bins.bin_id]

  status lpn_status_enum

  created_at timestamp
}

Table lpn_details {
  lpn_detail_id uuid [pk]

  lpn_id uuid [not null, ref: > lpns.lpn_id]
  sku_id uuid [not null, ref: > skus.sku_id]

  quantity int
}



// =====================================================
// INVENTORY
// =====================================================

Table inventories {
  inventory_id uuid [pk]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]

  sku_id uuid [not null, ref: > skus.sku_id]

  batch_id uuid [ref: > batches.batch_id]

  lpn_id uuid [ref: > lpns.lpn_id]

  bin_id uuid [ref: > bins.bin_id]

  quantity int

  inventory_status inventory_status_enum

  received_at timestamp
  updated_at timestamp
}

Table inventory_movements {
  movement_id uuid [pk]

  inventory_id uuid [not null, ref: > inventories.inventory_id]

  from_bin_id uuid [ref: > bins.bin_id]
  to_bin_id uuid [ref: > bins.bin_id]

  movement_type movement_type_enum

  quantity int

  created_by uuid [ref: > users.user_id]

  created_at timestamp
}



// =====================================================
// OUTBOUND
// =====================================================

Table outbound_requests {
  outbound_request_id uuid [pk]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]
  contract_id uuid [not null, ref: > contracts.contract_id]

  request_code varchar [unique]

  requested_ship_date timestamp

  status outbound_status_enum

  created_by uuid [ref: > users.user_id]

  created_at timestamp
}

Table outbound_request_items {
  outbound_request_item_id uuid [pk]

  outbound_request_id uuid [not null, ref: > outbound_requests.outbound_request_id]

  sku_id uuid [not null, ref: > skus.sku_id]

  requested_quantity int
  allocated_quantity int
}

Table picking_tasks {
  picking_task_id uuid [pk]

  outbound_request_id uuid [ref: > outbound_requests.outbound_request_id]

  assigned_to uuid [ref: > users.user_id]

  status picking_task_status_enum

  created_at timestamp
}

Table picking_task_items {
  picking_task_item_id uuid [pk]

  picking_task_id uuid [not null, ref: > picking_tasks.picking_task_id]

  inventory_id uuid [ref: > inventories.inventory_id]

  picked_quantity int
}

Table shipments {
  shipment_id uuid [pk]

  outbound_request_id uuid [ref: > outbound_requests.outbound_request_id]

  shipment_code varchar

  shipped_at timestamp

  status shipment_status_enum
}



// =====================================================
// BILLING
// =====================================================

Table pricing_policies {
  pricing_policy_id uuid [pk]

  warehouse_id uuid [ref: > warehouses.warehouse_id]

  storage_level storage_level_enum

  pricing_method pricing_method_enum

  unit pricing_unit_enum

  box_type box_type_enum

  price decimal

  created_at timestamp
}

Table storage_usage_snapshots {
  snapshot_id uuid [pk]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]
  contract_id uuid [not null, ref: > contracts.contract_id]

  snapshot_date date

  box_type box_type_enum

  occupied_count int

  calculated_fee decimal

  created_at timestamp
}

Table invoices {
  invoice_id uuid [pk]

  contract_id uuid [not null, ref: > contracts.contract_id]
  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]

  invoice_code varchar [unique]

  billing_period_start timestamp
  billing_period_end timestamp

  subtotal decimal
  tax decimal
  total_amount decimal

  payment_status invoice_payment_status_enum

  issued_at timestamp
  due_date timestamp
}

Table invoice_items {
  invoice_item_id uuid [pk]

  invoice_id uuid [not null, ref: > invoices.invoice_id]

  item_type invoice_item_type_enum

  description varchar

  quantity decimal
  unit_price decimal
  total_price decimal
}

Table payments {
  payment_id uuid [pk]

  invoice_id uuid [not null, ref: > invoices.invoice_id]

  payment_method payment_method_enum

  amount decimal

  payment_status payment_status_enum

  paid_at timestamp
}



// =====================================================
// AI / OPTIMIZATION
// =====================================================

Table ai_slot_recommendations {
  recommendation_id uuid [pk]

  inbound_request_id uuid [ref: > inbound_requests.inbound_request_id]

  recommended_bin_id uuid [ref: > bins.bin_id]

  recommendation_score decimal

  reason text

  created_at timestamp
}

Table occupancy_snapshots {
  occupancy_snapshot_id uuid [pk]

  warehouse_id uuid [ref: > warehouses.warehouse_id]

  snapshot_date date

  occupancy_rate decimal

  created_at timestamp
}