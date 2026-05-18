MAIN FLOWS — PUBLIC FASHION WAREHOUSE SYSTEM

Schema tham chiếu: `docs/db4.md`

(Không bao gồm authentication — users dùng `role` enum trực tiếp)

1. Tenant Onboarding Flow
Mục tiêu

Tenant đăng ký thuê kho và ký hợp đồng.

Flow
Tenant submit rental request
    ↓
WH_ADMIN/SYSTEM_ADMIN review (UNDER_REVIEW)
    ↓
Negotiate pricing & storage type
    ↓
APPROVED → Create tenant company
    ↓
Create contract (gắn rental_request_id)
    ↓
Ký HĐ (tenant_signature, warehouse_signature) → ACTIVE
    ↓
Assign storage reservation (theo storage_level)
    ↓
Activate tenant → rental_requests.status = CONVERTED
Tables liên quan
rental_requests
tenant_companies
contracts
contract_items
storage_reservations

Status rental_requests
PENDING → UNDER_REVIEW → APPROVED → CONVERTED
                      ↘ REJECTED
(CONVERTED: đã tạo tenant + contract; tra contract qua `contracts.rental_request_id`)

2. Warehouse Structure Management Flow
Mục tiêu

Quản lý cấu trúc kho.

Flow
Create warehouse
    ↓
Create zones (zone_type: SHARED, DEDICATED, FAST_MOVING, BULK, PREMIUM, QC, RETURN)
    ↓
Create racks → rack levels
    ↓
Create bins (volume_units, max_lpn_count, shared policy)
Hierarchy
Warehouse → Zone → Rack → Rack Level → Bin → LPN → SKU
Tables liên quan
warehouses
warehouse_zones
racks
rack_levels
bins

3. SKU Management Flow
Mục tiêu

Quản lý thông tin sản phẩm thời trang.

Flow
Tenant create SKU (per tenant, sku_code unique trong tenant)
    ↓
Warehouse review (optional)
    ↓
SKU ACTIVE
SKU gồm: category, collection (theo tenant), season, color, size, material, movement_category
Tables liên quan
skus
categories
collections
seasons

4. Inbound Flow (Nhập kho)
Đây là flow core nhất
Flow tổng
Tenant tạo inbound request (cần contract_id + warehouse_id)
    ↓
Warehouse approve (APPROVED)
    ↓
Truck arrives (ARRIVED)
    ↓
Warehouse receiving (RECEIVING)
    ↓
Create batches (warehouse_received_at — FIFO)
    ↓
Create LPNs (box_type, volume_units)
    ↓
AI slot recommendation (zone + bin, is_applied)
    ↓
Putaway (PUTAWAY movement)
    ↓
Inventory updated (COMPLETED)
Flow chi tiết
4.1 Create Inbound Request
Tenant khai báo: SKU, quantity, expected_arrival_date
Tables: inbound_requests, inbound_request_items

4.2 Receiving
Unload, QC, kiểm đếm → discrepancy_quantity trên items
Tables: batches

4.3 LPN Creation
Tables: lpns, lpn_details

4.4 AI Putaway Recommendation
AI recommend zone + bin (không quyết định FIFO)
Tables: ai_slot_recommendations

4.5 Putaway
Scan LPN → bin; cập nhật inventories + inventory_movements (PUTAWAY)

5. Inventory Management Flow
Mục tiêu

Quản lý tồn kho realtime.

Flow
Inbound completed → quantity, reserved_quantity, available_quantity
    ↓
Movement tracking (INBOUND, PUTAWAY, RELOCATION, PICKING, OUTBOUND, SHIPPING, ADJUSTMENT)
    ↓
Allocation khi outbound (status RESERVED trên inventory)
Features
FIFO (received_at, batch age)
inventory lookup
occupancy (bins.used_volume_units, occupancy_snapshots)
Tables
inventories
inventory_movements

6. Storage Reservation Flow
Mục tiêu

Quản lý shared/reserved/dedicated storage.

Flow
Create reservation theo contract
    ↓
Chọn storage_level + FK tương ứng:
  WAREHOUSE → warehouse_id
  ZONE → zone_id
  RACK → rack_id
  RACK_LEVEL → rack_level_id
  BIN → bin_id
    ↓
Reserve capacity → track occupancy
Reservation types
SHARED | RESERVED | DEDICATED
Tables
storage_reservations

7. Outbound Flow (Xuất kho)
Flow tổng
Tenant create outbound request
    ↓
Warehouse approve
    ↓
FIFO allocation (allocated_quantity — AI không allocate)
    ↓
RESERVED → Generate picking tasks
    ↓
PICKING (pick theo inventory + lpn + bin + batch)
    ↓
PACKING
    ↓
SHIPPED (shipments + tenant_id)
    ↓
COMPLETED — inventory deducted
7.1 Create Outbound Request
Tables: outbound_requests, outbound_request_items

7.2 FIFO Allocation
Dựa trên: received_at, batch age (warehouse_received_at)

7.3 Picking
Tables: picking_tasks, picking_task_items

7.4 Shipping
Tables: shipments (tenant_id, tracking_number, carrier_name)

8. Billing Flow
Flow tổng
Daily/monthly usage snapshots (billing_unit: BOX_DAY, BIN_DAY, …)
    ↓
Generate invoice (billing_start_date / billing_end_date)
    ↓
invoice_items + payments
8.1 Usage Tracking
Tables: storage_usage_snapshots

8.2 Invoice Generation
pricing_model: USAGE_BASED | FIXED | HYBRID
Tables: invoices, invoice_items

8.3 Payment
invoice.payment_status: PENDING | PAID | OVERDUE
payments.payment_status: PENDING | SUCCESS | FAILED
Tables: payments

9. AI Recommendation Flow
Mục tiêu

Tối ưu putaway và occupancy.

Flow
Inbound / LPN created
    ↓
Recommend slot (ai_slot_recommendations)
    ↓
Staff apply → is_applied = true
AI chỉ: recommend, analytics (sku_movement_analytics)
AI KHÔNG: FIFO, auto outbound, auto allocate
Tables
ai_slot_recommendations
occupancy_snapshots
sku_movement_analytics

10. Occupancy Monitoring Flow
Track bin → aggregate zone/warehouse → occupancy_snapshots
Tables: occupancy_snapshots, bins, inventories

11. Reporting Flow
inventory + inbound/outbound + billing + occupancy → export

12. Inventory Relocation Flow
inventory_movements (RELOCATION)

13. Damage Handling Flow
inventory.status = DAMAGED; zone_type QC / RETURN

14. Capacity Optimization Flow
AI suggest relocation từ sku_movement_analytics + occupancy

15. Tổng kết CORE FLOWS
Flow	Priority
Tenant onboarding	HIGH
Warehouse structure	HIGH
SKU management	HIGH
Inbound	CRITICAL
Inventory management	CRITICAL
Outbound	CRITICAL
Billing	CRITICAL
Reservation	HIGH
AI recommendation	MEDIUM
Reporting	HIGH
Relocation	MEDIUM
Damage handling	MEDIUM

16. Nếu phải demo capstone
MUST HAVE
✅ Warehouse hierarchy
✅ SKU management
✅ Inbound + LPN + putaway
✅ Inventory + FIFO outbound
✅ Billing (usage snapshots)
✅ AI recommendation
✅ Reporting

OPTIONAL
relocation
damage handling
sku_movement_analytics dashboards
realtime websocket
Kafka events
