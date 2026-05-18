MAIN FLOWS — PUBLIC FASHION WAREHOUSE SYSTEM

(Không bao gồm authentication)

1. Tenant Onboarding Flow
Mục tiêu

Tenant đăng ký thuê kho và ký hợp đồng.

Flow
Tenant submit rental request
    ↓
WH_ADMIN/SYSTEM_ADMIN review
    ↓
Negotiate pricing & storage type
    ↓
Create tenant company
    ↓
Create contract
    ↓
Assign storage reservation
    ↓
Activate tenant
Tables liên quan
rental_requests
tenant_companies
contracts
contract_items
storage_reservations

Status rental_requests
PENDING → UNDER_REVIEW → APPROVED → CONVERTED
                      ↘ REJECTED
(CONVERTED: đã tạo tenant + contract; tra contract qua contracts.rental_request_id)
2. Warehouse Structure Management Flow
Mục tiêu

Quản lý cấu trúc kho.

Flow
Create warehouse
    ↓
Create zones
    ↓
Create racks
    ↓
Create rack levels
    ↓
Create bins
Hierarchy
Warehouse
    ↓
Zone
    ↓
Rack
    ↓
Rack Level
    ↓
Bin
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
Tenant create SKU
    ↓
Warehouse review (optional)
    ↓
SKU active
SKU gồm
loại quần áo
màu
size
material
collection
season
Tables liên quan
skus
categories
collections
seasons
4. Inbound Flow (Nhập kho)
Đây là flow core nhất
Flow tổng
Tenant tạo inbound request
    ↓
Warehouse approve inbound
    ↓
Truck arrives warehouse
    ↓
Warehouse receiving
    ↓
Create batches
    ↓
Create LPNs
    ↓
AI slot recommendation
    ↓
Putaway into bins
    ↓
Inventory updated
Flow chi tiết
4.1 Create Inbound Request

Tenant khai báo:

SKU
quantity
expected arrival
Tables
inbound_requests
inbound_request_items
4.2 Receiving

Warehouse:

unload hàng
QC
kiểm đếm
Tables
batches
4.3 LPN Creation

Tạo:

thùng/carton
Tables
lpns
lpn_details
4.4 AI Putaway Recommendation

AI recommend:

zone
rack
level
bin
Tables
ai_slot_recommendations
4.5 Putaway

Warehouse staff:

scan LPN
đưa vào bin
Tables
inventories
inventory_movements
5. Inventory Management Flow
Mục tiêu

Quản lý tồn kho realtime.

Flow
Inbound completed
    ↓
Inventory available
    ↓
Movement tracking
    ↓
Inventory allocation
    ↓
Inventory aging tracking
Features
FIFO
inventory lookup
occupancy tracking
stock availability
Tables
inventories
inventory_movements
6. Storage Reservation Flow
Mục tiêu

Quản lý shared/reserved/dedicated storage.

Flow
Create reservation
    ↓
Assign storage level
    ↓
Reserve capacity
    ↓
Track occupancy
Reservation types
Type	Meaning
SHARED	dùng chung
RESERVED	reserve riêng
DEDICATED	thuê nguyên khu
Tables
storage_reservations
7. Outbound Flow (Xuất kho)
Flow tổng
Tenant create outbound request
    ↓
Warehouse approve
    ↓
FIFO allocation
    ↓
Generate picking tasks
    ↓
Picking
    ↓
Packing
    ↓
Shipping
    ↓
Inventory deducted
7.1 Create Outbound Request

Tenant yêu cầu:

SKU
quantity
ship date
Tables
outbound_requests
outbound_request_items
7.2 FIFO Allocation

System:

tự allocate inventory
Quan trọng:

AI không quyết định FIFO.

FIFO dựa trên:
received_at
batch age
7.3 Picking

Warehouse staff:

pick inventory
scan LPN/bin
Tables
picking_tasks
picking_task_items
7.4 Shipping

Tạo shipment.

Tables
shipments
8. Billing Flow
Flow tổng
Track storage usage
    ↓
Generate usage snapshots
    ↓
Calculate invoice
    ↓
Generate invoice items
    ↓
Payment tracking
8.1 Usage Tracking

System snapshot:

occupancy
reserved capacity
overflow usage
Tables
storage_usage_snapshots
8.2 Invoice Generation

Tính theo:

FIXED
USAGE_BASED
HYBRID
Tables
invoices
invoice_items
8.3 Payment

Theo dõi:

paid
overdue
Tables
payments
9. AI Recommendation Flow
Mục tiêu

Tối ưu putaway và occupancy.

Flow
Inbound created
    ↓
Collect warehouse data
    ↓
Generate embeddings
    ↓
Vector search
    ↓
LLM reasoning
    ↓
Recommend best slot
AI chỉ:
recommend
analytics
optimization
AI KHÔNG:
quyết định FIFO
tự động xuất kho
tự động allocate inventory
Tables
ai_embedding_documents
ai_slot_recommendations
occupancy_snapshots
10. Occupancy Monitoring Flow
Mục tiêu

Theo dõi mức sử dụng kho.

Flow
Track bin occupancy
    ↓
Aggregate rack occupancy
    ↓
Aggregate zone occupancy
    ↓
Generate occupancy snapshot
Metrics
occupancy rate
available capacity
reserved capacity
overflow risk
Tables
occupancy_snapshots
bins
inventories
11. Reporting Flow
Mục tiêu

Xuất báo cáo cho tenant.

Flow
Collect inventory data
    ↓
Collect billing data
    ↓
Generate report
    ↓
Export Excel/PDF
    ↓
Send to tenant
Report gồm
inventory summary
SKU list
current occupancy
inbound/outbound history
billing summary
12. Inventory Relocation Flow
Mục tiêu

Di chuyển hàng trong kho.

Flow
Create relocation request
    ↓
Move inventory
    ↓
Update inventory location
    ↓
Track movement logs
Tables
inventory_movements
13. Damage Handling Flow
Mục tiêu

Xử lý hàng hư hỏng.

Flow
Detect damaged inventory
    ↓
Mark inventory damaged
    ↓
Move to damage zone
    ↓
Notify tenant
Inventory status
DAMAGED
14. Capacity Optimization Flow
Mục tiêu

Tối ưu occupancy.

Flow
Analyze occupancy
    ↓
Detect fragmented bins
    ↓
Suggest relocation
    ↓
Optimize available capacity
Đây là nơi AI rất hợp lý.
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
✅ Inbound
✅ Putaway
✅ Inventory
✅ FIFO outbound
✅ Billing
✅ AI recommendation
✅ Reporting

OPTIONAL
relocation
damage handling
advanced analytics
realtime websocket
Kafka events