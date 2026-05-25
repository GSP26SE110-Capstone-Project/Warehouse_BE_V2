// ======================================================
// PUBLIC FASHION WAREHOUSE MANAGEMENT SYSTEM
// CLEAN FINAL DBML
// Multi-tenant | Contract-based | FIFO | LPN | Daily Usage Billing
// ======================================================

// ======================================================
// ENUMS
// ======================================================

Enum role_enum {
  SYSTEM_ADMIN
  WH_ADMIN
  WH_STAFF
  TENANT_ADMIN
  TENANT_STAFF
}

Enum user_status_enum {
  ACTIVE
  INACTIVE
  SUSPENDED
  BLOCKED
}

Enum tenant_status_enum {
  ACTIVE
  SUSPENDED
}

Enum warehouse_status_enum {
  ACTIVE
  INACTIVE
  MAINTENANCE
  CLOSED
}

Enum zone_type_enum {
  SHARED
  FAST_MOVING
  PREMIUM
  RETURN
}

Enum zone_status_enum {
  ACTIVE
  BLOCKED
}

Enum rack_type_enum {
  STANDARD
}

Enum rack_status_enum {
  ACTIVE
  BLOCKED
}

Enum bin_status_enum {
  EMPTY
  PARTIAL
  FULL
  RESERVED
  BLOCKED
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
  DAILY
  MONTHLY
  QUARTERLY
  YEARLY
}

Enum billing_unit_enum {
  BOX_DAY
  BIN_DAY
  RACK_DAY
  ZONE_DAY
  WAREHOUSE_DAY
  INBOUND_LPN
  OUTBOUND_LPN
  HANDLING_UNIT
}

Enum contract_status_enum {
  DRAFT
  PENDING_APPROVAL
  ACTIVE
  EXPIRED
  TERMINATED
  CANCELLED
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

Enum storage_level_enum {
  WAREHOUSE
  ZONE
  RACK
  RACK_LEVEL
  BIN
}

Enum rental_request_status_enum {
  PENDING
  UNDER_REVIEW
  APPROVED
  REJECTED
  CONVERTED
}

Enum box_type_enum {
  SMALL
  MEDIUM
  LARGE
  EXTRA
}

Enum movement_category_enum {
  FAST
  NORMAL
  SLOW
}

Enum sku_status_enum {
  ACTIVE
  INACTIVE
}

Enum inbound_status_enum {
  DRAFT
  PENDING
  APPROVED
  ARRIVED
  RECEIVING
  COMPLETED
  CANCELLED
}

Enum lpn_status_enum {
  RECEIVING
  STORED
  PICKED
  SHIPPED
  DAMAGED
}

Enum inventory_status_enum {
  AVAILABLE
  RESERVED
  PICKED
  DAMAGED
  IN_TRANSIT
  SHIPPED
}

Enum movement_type_enum {
  INBOUND
  PUTAWAY
  RELOCATION
  PICKING
  OUTBOUND
  SHIPPING
  ADJUSTMENT
}

Enum outbound_status_enum {
  DRAFT
  PENDING
  APPROVED
  RESERVED
  PICKING
  PACKING
  SHIPPED
  COMPLETED
  CANCELLED
}

Enum picking_task_status_enum {
  PENDING
  PICKING
  COMPLETED
  CANCELLED
}

Enum shipment_status_enum {
  READY
  SHIPPED
  DELIVERED
  CANCELLED
}

Enum invoice_payment_status_enum {
  PENDING
  PAID
  OVERDUE
  CANCELLED
}

Enum invoice_item_type_enum {
  STORAGE
  INBOUND
  OUTBOUND
  HANDLING
  REPACKING
  SLA
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

// ======================================================
// AUTH & ORGANIZATION
// ======================================================

Table tenant_companies {
  tenant_id uuid [pk]

  company_name varchar [not null]
  company_code varchar [unique]
  tax_code varchar [unique]

  contact_name varchar
  contact_email varchar
  contact_phone varchar

  address text

  status tenant_status_enum [default: 'ACTIVE']

  created_at timestamp
  updated_at timestamp

  indexes {
    status
  }
}

Table warehouses {
  warehouse_id uuid [pk]

  warehouse_code varchar [unique, not null]
  warehouse_name varchar [not null]
  address text

  city varchar [note: 'Match rental request region']
  district varchar

  total_area_m2 decimal
  usable_area_m2 decimal

  status warehouse_status_enum [default: 'ACTIVE']

  created_at timestamp
  updated_at timestamp
}

// ======================================================
// LOCATION REFERENCE (guest rental form dropdowns)
// rental_requests.city / district store VARCHAR labels (no FK)
// ======================================================

Table cities {
  city_id uuid [pk]

  city_code varchar [unique, not null, note: 'e.g. HCM, HN']
  city_name varchar [unique, not null, note: 'e.g. TP.HCM, Hà Nội — matches warehouses.city']

  display_order int [default: 0]
  is_active boolean [default: true]

  created_at timestamp
}

Table districts {
  district_id uuid [pk]

  city_id uuid [not null, ref: > cities.city_id]

  district_name varchar [not null, note: 'e.g. Quận 7 — matches warehouses.district']

  display_order int [default: 0]
  is_active boolean [default: true]

  created_at timestamp

  indexes {
    (city_id, district_name) [unique]
    city_id
  }
}

Table users {
  user_id uuid [pk]

  tenant_id uuid [ref: > tenant_companies.tenant_id, note: 'Only for TENANT_ADMIN / TENANT_STAFF']
  warehouse_id uuid [ref: > warehouses.warehouse_id, note: 'Only for WH_ADMIN / WH_STAFF']

  full_name varchar [not null]
  email varchar [unique, not null]
  password_hash varchar [not null]
  phone varchar

  role role_enum [not null]
  status user_status_enum [default: 'ACTIVE']

  created_at timestamp
  updated_at timestamp

  indexes {
    tenant_id
    warehouse_id
    role
  }
}

// ======================================================
// WAREHOUSE STRUCTURE
// Warehouse -> Zone -> Rack -> Rack Level -> Bin
// ======================================================

Table warehouse_zones {
  zone_id uuid [pk]

  warehouse_id uuid [not null, ref: > warehouses.warehouse_id]

  zone_code varchar [not null]
  zone_name varchar
  zone_type zone_type_enum [default: 'SHARED']

  area_m2 decimal
  is_dedicated boolean [default: false]
  status zone_status_enum [default: 'ACTIVE']

  created_at timestamp
  updated_at timestamp

  indexes {
    (warehouse_id, zone_code) [unique]
    status
  }
}

Table racks {
  rack_id uuid [pk]

  zone_id uuid [not null, ref: > warehouse_zones.zone_id]

  rack_code varchar [not null]
  rack_type rack_type_enum [default: 'STANDARD']
  max_levels int
  status rack_status_enum [default: 'ACTIVE']

  created_at timestamp
  updated_at timestamp

  indexes {
    (zone_id, rack_code) [unique]
    status
  }
}

Table rack_levels {
  rack_level_id uuid [pk]

  rack_id uuid [not null, ref: > racks.rack_id]

  level_code varchar
  level_number int [not null]

  max_bins int
  max_weight_kg decimal
  height_cm decimal
  level_priority int

  created_at timestamp
  updated_at timestamp

  indexes {
    (rack_id, level_number) [unique]
  }
}

Table bins {
  bin_id uuid [pk]

  rack_level_id uuid [not null, ref: > rack_levels.rack_level_id]

  bin_code varchar [not null]
  supported_box_type box_type_enum

  max_lpn_count int [not null, note: 'Example: 1 bin can contain 4 LPN/cartons']
  current_lpn_count int [default: 0]

  max_volume_units int [not null, note: 'SMALL=1, MEDIUM=2, LARGE=4, EXTRA=8']
  used_volume_units int [default: 0]

  max_owner_count int [default: 3, note: 'For shared bin policy']

  reservation_type reservation_type_enum [default: 'SHARED']
  status bin_status_enum [default: 'EMPTY']

  created_at timestamp
  updated_at timestamp

  indexes {
    (rack_level_id, bin_code) [unique]
    status
    reservation_type
  }
}

// ======================================================
// RENTAL REQUEST & CONTRACT
// ======================================================

Table rental_requests {
  rental_request_id uuid [pk]

  request_code varchar [unique, not null]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]

  city varchar [not null, note: 'Desired region — value from cities.city_name catalog']
  district varchar [not null, note: 'Value from districts.district_name catalog']

  warehouse_id uuid [ref: > warehouses.warehouse_id, note: 'Set when a warehouse claims (approves) first']

  // ======================================================
  // RENTAL TARGET
  // ======================================================

  contract_type contract_type_enum
  pricing_model pricing_model_enum
  billing_cycle billing_cycle_enum

  // ======================================================
  // STORAGE ESTIMATION
  // ======================================================

  estimated_sku_count int
  estimated_box_count int

  estimated_volume decimal [note: 'Estimated goods volume (m³), not warehouse area']
  requested_area_m2 decimal [note: 'Guest desired area (m²); optional — DEDICATED_WAREHOUSE / DEDICATED_ZONE']
  average_storage_days int

  // ======================================================
  // OPERATION ESTIMATION
  // ======================================================

  estimated_inbound_per_week int [note: 'Avg inbound trips per week (guest form)']
  estimated_outbound_per_week int [note: 'Avg outbound trips per week (guest form)']

  // ======================================================
  // STORAGE REQUIREMENTS
  // ======================================================

  requires_fast_picking boolean [default: false]
  requires_premium_storage boolean [default: false]

  notes text

  // ======================================================
  // REVIEW RESULT
  // ======================================================

  suggested_zone_type zone_type_enum
  suggested_rack_type rack_type_enum

  // ======================================================
  // CONTRACT PERIOD
  // ======================================================

  expected_start_date timestamp
  expected_end_date timestamp

  // ======================================================
  // WORKFLOW
  // ======================================================

  status rental_request_status_enum [default: 'PENDING']

  reviewed_by uuid [ref: > users.user_id]
  reviewed_at timestamp

  rejection_reason text
  review_note text

  // ======================================================
  // AUDIT
  // ======================================================

  created_by uuid [ref: > users.user_id]

  created_at timestamp
  updated_at timestamp

  indexes {
    tenant_id
    city
    district
    warehouse_id
    contract_type
    pricing_model
    status

    suggested_zone_type
    suggested_rack_type
  }
}

Table contracts {
  contract_id uuid [pk]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]
  warehouse_id uuid [not null, ref: > warehouses.warehouse_id]
  rental_request_id uuid [unique, ref: > rental_requests.rental_request_id]

  contract_code varchar [unique, not null]
  contract_name varchar

  contract_type contract_type_enum [not null]
  pricing_model pricing_model_enum [not null]
  billing_cycle billing_cycle_enum [default: 'MONTHLY']

  allow_dynamic_relocation boolean [default: true]
  auto_renew boolean [default: false]

  start_date date [not null]
  end_date date [not null]

  minimum_billing_days int [default: 1]
  minimum_reserved_capacity decimal
  estimated_total_amount decimal

  status contract_status_enum [default: 'DRAFT']

  tenant_signature text
  warehouse_signature text

  created_by uuid [ref: > users.user_id]
  approved_by uuid [ref: > users.user_id]

  created_at timestamp
  updated_at timestamp

  indexes {
    tenant_id
    warehouse_id
    rental_request_id
    status
  }
}

Table contract_items {
  contract_item_id uuid [pk]

  contract_id uuid [not null, ref: > contracts.contract_id]

  item_type invoice_item_type_enum [not null]
  storage_level storage_level_enum
  billing_unit billing_unit_enum [not null]

  quantity decimal
  reserved_quantity int
  box_type box_type_enum

  unit_price decimal [not null]

  created_at timestamp
}

// Business rule for storage_reservations:
// - storage_level = WAREHOUSE  => warehouse_id is required
// - storage_level = ZONE       => zone_id is required
// - storage_level = RACK       => rack_id is required
// - storage_level = RACK_LEVEL => rack_level_id is required
// - storage_level = BIN        => bin_id is required

Table storage_reservations {
  reservation_id uuid [pk]

  contract_id uuid [not null, ref: > contracts.contract_id]
  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]

  reservation_type reservation_type_enum [not null]
  storage_level storage_level_enum [not null]

  warehouse_id uuid [not null, ref: > warehouses.warehouse_id]
  zone_id uuid [ref: > warehouse_zones.zone_id]
  rack_id uuid [ref: > racks.rack_id]
  rack_level_id uuid [ref: > rack_levels.rack_level_id]
  bin_id uuid [ref: > bins.bin_id]

  reserved_capacity decimal
  box_type box_type_enum

  start_date date [not null]
  end_date date [not null]

  status reservation_status_enum [default: 'ACTIVE']

  created_at timestamp
  updated_at timestamp

  indexes {
    tenant_id
    contract_id
    storage_level
    warehouse_id
    zone_id
    rack_id
    rack_level_id
    bin_id
    status
  }
}

// ======================================================
// PRODUCT / SKU
// ======================================================

Table categories {
  category_id uuid [pk]
  category_name varchar [not null]
}

Table collections {
  collection_id uuid [pk]
  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]
  collection_name varchar [not null]
}

Table seasons {
  season_id uuid [pk]
  season_name varchar [not null]
}

Table skus {
  sku_id uuid [pk]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]

  sku_code varchar [not null]
  product_name varchar [not null]

  category_id uuid [ref: > categories.category_id]
  collection_id uuid [ref: > collections.collection_id]
  season_id uuid [ref: > seasons.season_id]

  color varchar
  size varchar
  material varchar

  movement_category movement_category_enum [default: 'NORMAL']
  status sku_status_enum [default: 'ACTIVE']

  created_at timestamp
  updated_at timestamp

  indexes {
    (tenant_id, sku_code) [unique]
    category_id
    collection_id
    season_id
  }
}

// ======================================================
// INBOUND
// ======================================================

Table inbound_requests {
  inbound_request_id uuid [pk]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]
  contract_id uuid [not null, ref: > contracts.contract_id]
  warehouse_id uuid [not null, ref: > warehouses.warehouse_id]

  inbound_code varchar [unique, not null]

  expected_arrival_date timestamp
  actual_arrival_at timestamp

  status inbound_status_enum [default: 'PENDING']

  created_by uuid [ref: > users.user_id]
  approved_by uuid [ref: > users.user_id]
  received_by uuid [ref: > users.user_id]

  created_at timestamp
  updated_at timestamp

  indexes {
    tenant_id
    contract_id
    warehouse_id
    status
  }
}

Table inbound_request_items {
  inbound_request_item_id uuid [pk]

  inbound_request_id uuid [not null, ref: > inbound_requests.inbound_request_id]
  sku_id uuid [not null, ref: > skus.sku_id]

  expected_quantity int [not null]
  received_quantity int [default: 0]
  discrepancy_quantity int [default: 0]

  created_at timestamp

  indexes {
    inbound_request_id
    sku_id
  }
}

Table batches {
  batch_id uuid [pk]

  inbound_request_id uuid [not null, ref: > inbound_requests.inbound_request_id]

  batch_code varchar [unique, not null]
  warehouse_received_at timestamp [not null]

  created_at timestamp

  indexes {
    inbound_request_id
    warehouse_received_at
  }
}

// ======================================================
// LPN
// 1 LPN = 1 Tenant / Owner
// ======================================================

Table lpns {
  lpn_id uuid [pk]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]
  batch_id uuid [not null, ref: > batches.batch_id]

  lpn_code varchar [unique, not null]

  box_type box_type_enum [not null]
  volume_units int [not null, note: 'SMALL=1, MEDIUM=2, LARGE=4, EXTRA=8']

  max_capacity int
  actual_quantity int [default: 0]
  fill_percentage decimal
  weight_kg decimal [note: 'Carton weight kg; rack type suggestion']

  current_bin_id uuid [ref: > bins.bin_id]

  status lpn_status_enum [default: 'RECEIVING']

  created_at timestamp
  updated_at timestamp

  indexes {
    tenant_id
    batch_id
    current_bin_id
    status
    box_type
  }
}

Table lpn_details {
  lpn_detail_id uuid [pk]

  lpn_id uuid [not null, ref: > lpns.lpn_id]
  sku_id uuid [not null, ref: > skus.sku_id]

  quantity int [not null]

  indexes {
    lpn_id
    sku_id
  }
}

// ======================================================
// INVENTORY
// Granularity = SKU + Batch + LPN + Bin + Status
// ======================================================

Table inventories {
  inventory_id uuid [pk]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]
  sku_id uuid [not null, ref: > skus.sku_id]
  batch_id uuid [not null, ref: > batches.batch_id]
  lpn_id uuid [not null, ref: > lpns.lpn_id]
  bin_id uuid [not null, ref: > bins.bin_id]

  quantity int [not null]
  reserved_quantity int [default: 0]
  available_quantity int [default: 0, note: 'Derived field: quantity - reserved_quantity, stored for query optimization']

  status inventory_status_enum [default: 'AVAILABLE']

  received_at timestamp
  created_at timestamp
  updated_at timestamp

  indexes {
    tenant_id
    sku_id
    batch_id
    lpn_id
    bin_id
    status
    (tenant_id, sku_id, status)
  }
}

Table inventory_movements {
  movement_id uuid [pk]

  inventory_id uuid [not null, ref: > inventories.inventory_id]

  movement_type movement_type_enum [not null]

  from_bin_id uuid [ref: > bins.bin_id]
  to_bin_id uuid [ref: > bins.bin_id]

  quantity int [not null]

  moved_by uuid [ref: > users.user_id]
  moved_at timestamp

  note text

  indexes {
    inventory_id
    movement_type
    moved_at
  }
}

// ======================================================
// OUTBOUND
// ======================================================

Table outbound_requests {
  outbound_request_id uuid [pk]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]
  contract_id uuid [not null, ref: > contracts.contract_id]
  warehouse_id uuid [not null, ref: > warehouses.warehouse_id]

  outbound_code varchar [unique, not null]

  requested_ship_date timestamp
  actual_shipped_at timestamp

  status outbound_status_enum [default: 'PENDING']

  created_by uuid [ref: > users.user_id]
  approved_by uuid [ref: > users.user_id]

  created_at timestamp
  updated_at timestamp

  indexes {
    tenant_id
    contract_id
    warehouse_id
    status
  }
}

Table outbound_request_items {
  outbound_request_item_id uuid [pk]

  outbound_request_id uuid [not null, ref: > outbound_requests.outbound_request_id]
  sku_id uuid [not null, ref: > skus.sku_id]

  requested_quantity int [not null]
  allocated_quantity int [default: 0]
  picked_quantity int [default: 0]

  indexes {
    outbound_request_id
    sku_id
  }
}

Table picking_tasks {
  picking_task_id uuid [pk]

  outbound_request_id uuid [not null, ref: > outbound_requests.outbound_request_id]

  assigned_to uuid [ref: > users.user_id]

  status picking_task_status_enum [default: 'PENDING']

  created_at timestamp
  updated_at timestamp

  indexes {
    outbound_request_id
    assigned_to
    status
  }
}

Table picking_task_items {
  picking_task_item_id uuid [pk]

  picking_task_id uuid [not null, ref: > picking_tasks.picking_task_id]

  inventory_id uuid [not null, ref: > inventories.inventory_id]
  lpn_id uuid [not null, ref: > lpns.lpn_id]
  bin_id uuid [not null, ref: > bins.bin_id]
  batch_id uuid [not null, ref: > batches.batch_id]

  quantity_to_pick int [not null]
  picked_quantity int [default: 0]

  indexes {
    picking_task_id
    inventory_id
    lpn_id
    bin_id
    batch_id
  }
}

Table shipments {
  shipment_id uuid [pk]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]
  outbound_request_id uuid [not null, ref: > outbound_requests.outbound_request_id]

  shipment_code varchar [unique]
  carrier_name varchar
  tracking_number varchar

  status shipment_status_enum [default: 'READY']

  shipped_at timestamp
  delivered_at timestamp

  created_at timestamp
  updated_at timestamp

  indexes {
    tenant_id
    outbound_request_id
    status
  }
}

// ======================================================
// PRICING & BILLING
// ======================================================

Table pricing_policies {
  pricing_policy_id uuid [pk]

  warehouse_id uuid [ref: > warehouses.warehouse_id, note: 'NULL means global price']

  contract_type contract_type_enum
  storage_level storage_level_enum
  billing_unit billing_unit_enum [not null]
  box_type box_type_enum

  price decimal [not null]

  effective_from timestamp
  effective_to timestamp

  created_at timestamp

  indexes {
    warehouse_id
    contract_type
    billing_unit
    box_type
  }
}

Table storage_usage_snapshots {
  snapshot_id uuid [pk]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]
  contract_id uuid [not null, ref: > contracts.contract_id]

  snapshot_date date [not null]

  storage_level storage_level_enum
  billing_unit billing_unit_enum [not null]
  box_type box_type_enum

  occupied_count int [not null]
  calculated_fee decimal [not null]

  created_at timestamp

  indexes {
    (tenant_id, contract_id, snapshot_date, billing_unit, box_type) [unique]
  }
}

Table invoices {
  invoice_id uuid [pk]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]
  contract_id uuid [not null, ref: > contracts.contract_id]

  invoice_code varchar [unique, not null]

  billing_start_date date [not null]
  billing_end_date date [not null]

  subtotal decimal
  tax decimal
  total_amount decimal

  payment_status invoice_payment_status_enum [default: 'PENDING']

  issued_at timestamp
  due_date timestamp

  created_at timestamp
  updated_at timestamp

  indexes {
    tenant_id
    contract_id
    payment_status
  }
}

Table invoice_items {
  invoice_item_id uuid [pk]

  invoice_id uuid [not null, ref: > invoices.invoice_id]

  item_type invoice_item_type_enum [not null]
  description varchar

  reference_id uuid [note: 'Can reference usage snapshot, inbound, outbound, etc.']

  quantity decimal [not null]
  unit_price decimal [not null]
  total_price decimal [not null]
}

Table payments {
  payment_id uuid [pk]

  invoice_id uuid [not null, ref: > invoices.invoice_id]

  amount decimal [not null]

  payment_method payment_method_enum
  payment_status payment_status_enum [default: 'PENDING']

  transaction_code varchar
  paid_at timestamp

  created_at timestamp
}

// ======================================================
// AI / ANALYTICS
// ======================================================

Table ai_slot_recommendations {
  recommendation_id uuid [pk]

  inbound_request_id uuid [ref: > inbound_requests.inbound_request_id]
  lpn_id uuid [ref: > lpns.lpn_id]
  sku_id uuid [ref: > skus.sku_id]

  recommended_zone_id uuid [ref: > warehouse_zones.zone_id]
  recommended_bin_id uuid [ref: > bins.bin_id]

  recommendation_score decimal
  reason text
  is_applied boolean [default: false]

  created_at timestamp
}

Table occupancy_snapshots {
  occupancy_snapshot_id uuid [pk]

  warehouse_id uuid [ref: > warehouses.warehouse_id]
  zone_id uuid [ref: > warehouse_zones.zone_id]

  occupancy_rate decimal
  available_capacity int

  snapshot_date date
  created_at timestamp

  indexes {
    warehouse_id
    zone_id
    snapshot_date
  }
}

Table sku_movement_analytics {
  analytics_id uuid [pk]

  sku_id uuid [ref: > skus.sku_id]

  snapshot_date date

  inbound_qty int
  outbound_qty int
  picking_count int
  average_storage_days decimal
  turnover_score decimal

  movement_category movement_category_enum

  indexes {
    (sku_id, snapshot_date) [unique]
  }
}
