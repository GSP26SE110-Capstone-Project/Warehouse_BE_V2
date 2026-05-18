// ======================================================
// PUBLIC FASHION WAREHOUSE MANAGEMENT SYSTEM
// FINAL DB DESIGN - REVISED BUSINESS VERSION
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
}

Enum tenant_status_enum {
  ACTIVE
  SUSPENDED
}

Enum warehouse_status_enum {
  ACTIVE
  INACTIVE
  MAINTENANCE
}

Enum zone_type_enum {
  SHARED
  FAST_MOVING
  PREMIUM
  QC
  RETURN
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

Enum payment_status_enum {
  PENDING
  PAID
  OVERDUE
  CANCELLED
}

Enum payment_method_enum {
  BANK_TRANSFER
  CASH
  E_WALLET
}

Enum invoice_item_type_enum {
  STORAGE
  INBOUND
  OUTBOUND
  HANDLING
  REPACKING
  SLA
}

// ======================================================
// USERS & TENANT
// ======================================================

Table tenant_companies {
  tenant_id uuid [pk]

  company_name varchar [not null]
  tax_code varchar [unique]

  contact_name varchar
  contact_email varchar
  contact_phone varchar

  address text

  status tenant_status_enum [default: 'ACTIVE']

  created_at timestamp
  updated_at timestamp
}

Table users {
  user_id uuid [pk]

  tenant_id uuid [ref: > tenant_companies.tenant_id, note: 'Only for TENANT_ADMIN / TENANT_STAFF']
  warehouse_id uuid [ref: > warehouses.warehouse_id, note: 'Only for WH_ADMIN / WH_STAFF']

  full_name varchar [not null]
  email varchar [unique, not null]
  password_hash varchar [not null]

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

Table warehouses {
  warehouse_id uuid [pk]

  warehouse_code varchar [unique, not null]
  warehouse_name varchar [not null]
  address text

  total_area_m2 decimal
  usable_area_m2 decimal

  status warehouse_status_enum [default: 'ACTIVE']

  created_at timestamp
  updated_at timestamp
}

Table warehouse_zones {
  zone_id uuid [pk]

  warehouse_id uuid [not null, ref: > warehouses.warehouse_id]

  zone_code varchar [not null]
  zone_name varchar
  zone_type zone_type_enum [default: 'SHARED']

  area_m2 decimal
  is_dedicated boolean [default: false]

  created_at timestamp
  updated_at timestamp

  indexes {
    (warehouse_id, zone_code) [unique]
  }
}

Table racks {
  rack_id uuid [pk]

  zone_id uuid [not null, ref: > warehouse_zones.zone_id]

  rack_code varchar [not null]
  max_levels int

  created_at timestamp
  updated_at timestamp

  indexes {
    (zone_id, rack_code) [unique]
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

  company_name varchar [not null]
  tax_code varchar

  contact_name varchar
  contact_email varchar
  contact_phone varchar

  requested_storage_type contract_type_enum
  pricing_model pricing_model_enum
  billing_cycle billing_cycle_enum

  estimated_volume decimal
  expected_start_date timestamp

  preferred_warehouse_id uuid [ref: > warehouses.warehouse_id]

  status rental_request_status_enum [default: 'PENDING']

  reviewed_by uuid [ref: > users.user_id]
  reviewed_at timestamp
  rejection_reason text

  created_by uuid [ref: > users.user_id]
  created_at timestamp
  updated_at timestamp
}

Table contracts {
  contract_id uuid [pk]

  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]
  warehouse_id uuid [not null, ref: > warehouses.warehouse_id]
  rental_request_id uuid [ref: > rental_requests.rental_request_id]

  contract_code varchar [unique, not null]
  contract_name varchar

  contract_type contract_type_enum [not null]
  pricing_model pricing_model_enum [not null]
  billing_cycle billing_cycle_enum [default: 'MONTHLY']

  allow_dynamic_relocation boolean [default: true]

  start_date date [not null]
  end_date date [not null]

  minimum_billing_days int [default: 1]
  minimum_reserved_capacity int

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
    status
  }
}

Table contract_items {
  contract_item_id uuid [pk]

  contract_id uuid [not null, ref: > contracts.contract_id]

  item_type invoice_item_type_enum [not null]
  storage_level storage_level_enum
  billing_unit billing_unit_enum [not null]

  reserved_quantity int
  box_type box_type_enum

  unit_price decimal [not null]

  created_at timestamp
}

Table storage_reservations {
  reservation_id uuid [pk]

  contract_id uuid [not null, ref: > contracts.contract_id]
  tenant_id uuid [not null, ref: > tenant_companies.tenant_id]

  reservation_type reservation_type_enum [not null]
  storage_level storage_level_enum [not null]

  warehouse_id uuid [not null, ref: > warehouses.warehouse_id]
  zone_id uuid [ref: > warehouse_zones.zone_id]
  rack_id uuid [ref: > racks.rack_id]
  bin_id uuid [ref: > bins.bin_id]

  reserved_capacity int
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
  tenant_id uuid [ref: > tenant_companies.tenant_id]
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
  available_quantity int [default: 0]

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

  outbound_request_id uuid [not null, ref: > outbound_requests.outbound_request_id]

  shipment_code varchar [unique]
  carrier_name varchar
  tracking_number varchar

  status shipment_status_enum [default: 'READY']

  shipped_at timestamp
  delivered_at timestamp

  created_at timestamp
  updated_at timestamp
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

  payment_status payment_status_enum [default: 'PENDING']

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
    sku_id
    snapshot_date
  }
}
