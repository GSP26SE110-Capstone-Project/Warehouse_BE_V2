# FE Flow Guide — NextGen Warehouse

> **Đối tượng đọc**: Team Frontend / Mobile.
> **Mục đích**: Hiểu toàn bộ luồng nghiệp vụ end-to-end để (1) thiết kế UI/UX, (2) viết user stories, (3) lập kế hoạch test, (4) làm tài liệu Capstone.
> **Phiên bản**: 1.0 — cập nhật 2026-05-28.
> **Nguồn**: tổng hợp từ `docs/flow.md`, `docs/db4.md`, `docs/request.md`, `docs/contract_type.md`, `docs/pricing.md`, `docs/relationship.md`.

---

## Mục lục

- [Phần A — Tổng quan hệ thống](#phần-a--tổng-quan-hệ-thống)
  - [A1. Hệ thống làm gì?](#a1-hệ-thống-làm-gì)
  - [A2. Các actor (role)](#a2-các-actor-role)
  - [A3. Các domain chính](#a3-các-domain-chính)
  - [A4. Hierarchy tổng quát](#a4-hierarchy-tổng-quát)
  - [A5. Vòng đời 1 đơn vị hàng](#a5-vòng-đời-1-đơn-vị-hàng)
- [Phần B — 13 Flow nghiệp vụ chi tiết](#phần-b--13-flow-nghiệp-vụ-chi-tiết)
  - [Flow 1 — Tenant Onboarding](#flow-1--tenant-onboarding)
  - [Flow 2 — Warehouse Structure](#flow-2--warehouse-structure)
  - [Flow 3 — SKU Management](#flow-3--sku-management)
  - [Flow 4 — Inbound (Nhập kho)](#flow-4--inbound-nhập-kho)
  - [Flow 5 — Inventory Management](#flow-5--inventory-management)
  - [Flow 6 — Storage Reservation](#flow-6--storage-reservation)
  - [Flow 7 — Outbound (Xuất kho)](#flow-7--outbound-xuất-kho)
  - [Flow 8 — Billing & Invoice](#flow-8--billing--invoice)
  - [Flow 9 — AI Recommendation](#flow-9--ai-recommendation)
  - [Flow 10 — Occupancy Monitoring](#flow-10--occupancy-monitoring)
  - [Flow 11 — Reporting](#flow-11--reporting)
  - [Flow 12 — Inventory Relocation](#flow-12--inventory-relocation)
  - [Flow 13 — Damage Handling](#flow-13--damage-handling)
- [Phần C — Cheat sheet cho FE](#phần-c--cheat-sheet-cho-fe)
  - [C1. Mapping flow → màn hình](#c1-mapping-flow--màn-hình)
  - [C2. State machine summary](#c2-state-machine-summary)
  - [C3. Permission matrix](#c3-permission-matrix)
  - [C4. Form validation reference](#c4-form-validation-reference)
  - [C5. Empty state & loading state](#c5-empty-state--loading-state)
- [Phần D — Demo script](#phần-d--demo-script)

---

# Phần A — Tổng quan hệ thống

## A1. Hệ thống làm gì?

**NextGen Warehouse** là phần mềm quản lý kho cho **dịch vụ cho thuê kho 3PL** trong ngành **thời trang**. Hệ thống cho phép:

- **Nhiều brand thời trang** (gọi là **tenant**) cùng thuê chỗ trong **1 hoặc nhiều warehouse** vật lý.
- Theo dõi tồn kho chi tiết tới từng **bin** (ô lưu nhỏ nhất) và từng **LPN** (carton/pallet).
- Tự động hoá luồng: **Nhập** → **Lưu trữ** → **Xuất** → **Giao hàng** → **Billing**.
- Áp dụng **AI** để gợi ý vị trí lưu trữ tối ưu.
- Hỗ trợ **4 hình thức thuê khác nhau**: shared / reserved / dedicated zone / dedicated warehouse.

> Hệ thống KHÔNG phải:
> - Phần mềm bán hàng (không có giỏ hàng, không có thanh toán cho người mua cuối).
> - ERP / kế toán đầy đủ.
> - Hệ thống giao hàng B2C.

## A2. Các actor (role)

| Role | Tên hiển thị | Quyền chính | Số lượng tiêu biểu |
|------|--------------|-------------|---------------------|
| `SYSTEM_ADMIN` | Quản trị hệ thống | Toàn quyền: tạo warehouse, tạo WH_ADMIN, xem mọi tenant | 1–3 |
| `WH_ADMIN` | Quản trị kho | Duyệt rental request, ký contract, quản lý cấu trúc kho, vận hành | 1 / warehouse |
| `WH_STAFF` | Nhân viên kho | Receive, put-away, pick, pack, ship, scan barcode | 5–20 / warehouse |
| `TENANT_ADMIN` | Quản trị brand | Quản lý user của brand, gửi rental request, tạo SKU, tạo inbound/outbound | 1 / tenant |
| `TENANT_STAFF` | Nhân viên brand | Tạo & theo dõi inbound/outbound, xem tồn kho, xem invoice | 2–10 / tenant |
| **Guest** | (chưa đăng nhập) | Xem landing page, gửi rental request lần đầu (chưa có account) | — |

### Ý nghĩa "tenant"

Trong tài liệu này, **tenant = brand thời trang** thuê kho. Ví dụ: Routine, Coolmate, Yody, Canifa,... Mỗi tenant có cấu hình riêng:

- Bộ SKU riêng.
- Bộ collection riêng.
- Hợp đồng riêng với warehouse.
- Tồn kho riêng (cách ly với tenant khác).

## A3. Các domain chính

```
┌────────────────────────────────────────────────────────────────────┐
│  1. AUTH & USER MANAGEMENT                                          │
│     login, register, change password, OTP                           │
├────────────────────────────────────────────────────────────────────┤
│  2. WAREHOUSE STRUCTURE                                             │
│     warehouse → zone → rack → rack_level → bin                      │
├────────────────────────────────────────────────────────────────────┤
│  3. TENANT ONBOARDING                                               │
│     rental_request → tenant_company → contract → storage_reservation│
├────────────────────────────────────────────────────────────────────┤
│  4. PRODUCT MASTER (per tenant)                                     │
│     category, season, collection, SKU                               │
├────────────────────────────────────────────────────────────────────┤
│  5. INBOUND                                                         │
│     inbound_request → batch → LPN → put-away                        │
├────────────────────────────────────────────────────────────────────┤
│  6. INVENTORY                                                       │
│     real-time tồn kho theo (bin, SKU, LPN, batch)                   │
├────────────────────────────────────────────────────────────────────┤
│  7. OUTBOUND                                                        │
│     outbound_request → picking → packing → shipment                 │
├────────────────────────────────────────────────────────────────────┤
│  8. BILLING                                                         │
│     usage snapshots → invoice → payment                             │
├────────────────────────────────────────────────────────────────────┤
│  9. AI & ANALYTICS                                                  │
│     slot recommendation, movement analytics, occupancy              │
└────────────────────────────────────────────────────────────────────┘
```

## A4. Hierarchy tổng quát

```
Warehouse (1 kho vật lý)
  └─ WarehouseZone (vùng — ambient/cold/fast-moving/premium/...)
       └─ Rack (kệ — standard/high-capacity)
            └─ RackLevel (tầng — lower/middle/upper)
                 └─ Bin (ô lưu — SMALL/MEDIUM/LARGE/EXTRA)
                      └─ LPN (carton/pallet)
                           └─ SKU + quantity
```

Ví dụ thực tế: `WH-HCM-01 → ZONE-A → RACK-A01 → LEVEL-2 → BIN-A01-2-03 → LPN-2026-00123 → SKU "Áo thun đỏ M" × 50 cái`.

## A5. Vòng đời 1 đơn vị hàng

```
Brand sản xuất xong hàng
   │
   ▼
1. Brand tạo SKU trong hệ thống (1 lần / mã sản phẩm)
   │
   ▼
2. Brand tạo INBOUND REQUEST (mỗi lần ship hàng lên kho)
   │
   ▼
3. WH duyệt
   │
   ▼
4. Truck tới kho → WH receive
   │
   ▼
5. WH tạo BATCH (lô hàng) → tạo LPN (đóng vào carton)
   │
   ▼
6. AI gợi ý vị trí → WH staff PUT-AWAY (đặt vào bin)
   │
   ▼
7. Hàng nằm trong INVENTORY (sẵn sàng để xuất)
   │
   ▼
8. Brand tạo OUTBOUND REQUEST khi cần xuất
   │
   ▼
9. WH duyệt → System reserve hàng (FIFO theo batch cũ trước)
   │
   ▼
10. WH staff PICK theo task → PACK → SHIP
    │
    ▼
11. Hàng tới tay khách / cửa hàng → COMPLETED
    │
    ▼
12. Inventory giảm tương ứng → snapshot ghi nhận → tính billing
```

---

# Phần B — 13 Flow nghiệp vụ chi tiết

Mỗi flow trình bày theo format:

- **🎯 Mục tiêu**
- **👤 Actor** chính
- **📋 Tiền điều kiện**
- **🔄 State machine** (nếu có)
- **📱 Step-by-step UI flow**
- **🔌 Endpoint backend liên quan**
- **⚠️ Edge case & rules**
- **🎨 Gợi ý màn hình FE**

---

## Flow 1 — Tenant Onboarding

> Tenant đăng ký thuê kho và ký hợp đồng để bắt đầu sử dụng dịch vụ.

### 🎯 Mục tiêu

Đưa 1 brand mới (tenant) từ trạng thái "khách lạ gửi inquiry" tới "có account + có contract ACTIVE để bắt đầu nhập hàng".

### 👤 Actor

- **Guest** (chưa login): submit rental request lần đầu qua landing page.
- **WH_ADMIN** / **SYSTEM_ADMIN**: review, approve, ký contract.
- **TENANT_ADMIN**: sau khi được kích hoạt, login lần đầu.

### 📋 Tiền điều kiện

- Warehouse đã được tạo (Flow 2).
- Có pricing policy (Flow 8) — hoặc warehouse admin ra giá thủ công.

### 🔄 State machine — `rental_requests.status`

```
            ┌─────────┐
            │ PENDING │ ← Guest submit form
            └────┬────┘
                 │ WH_ADMIN bắt đầu xử lý
                 ▼
         ┌──────────────┐
         │ UNDER_REVIEW │
         └──────┬───────┘
                │
        ┌───────┴────────┐
        ▼                ▼
   ┌──────────┐    ┌──────────┐
   │ APPROVED │    │ REJECTED │ (kết thúc)
   └────┬─────┘    └──────────┘
        │ Tạo tenant + contract
        ▼
   ┌──────────────┐
   │ CONVERTED    │ (kết thúc — đã có contract)
   └──────────────┘
```

### 📱 Step-by-step UI flow

**Bước 1 — Guest điền form rental request** (public landing page)

Form gồm:
- Thông tin công ty: tên brand, mã số thuế, địa chỉ, city, district.
- Liên hệ: full name, email, phone.
- Nhu cầu: loại hàng (FASHION), volume ước tính, ngày bắt đầu mong muốn.
- **Hình thức thuê** (`contract_type`):
  - `NEEDS_CONSULTATION` — chưa biết, cần WH tư vấn.
  - `SHARED_STORAGE` — share bin với tenant khác (rẻ nhất).
  - `RESERVED_STORAGE` — reserve cố định 1 số slot.
  - `DEDICATED_ZONE` — thuê nguyên 1 zone.
  - `DEDICATED_WAREHOUSE` — thuê nguyên 1 warehouse.
- Chu kỳ thanh toán mong muốn: `MONTHLY` / `YEARLY`.
- Ghi chú thêm.

Submit → status `PENDING`. FE hiển thị "Cảm ơn, chúng tôi sẽ liên hệ trong 24h."

**Bước 2 — WH_ADMIN xem danh sách rental request**

- Trang `/admin/rental-requests`.
- Filter: status, city, contract_type, date range.
- Click 1 row → modal hoặc trang chi tiết.

**Bước 3 — WH_ADMIN bắt đầu review**

- Click "Start review" → API chuyển status `PENDING` → `UNDER_REVIEW`.
- Có thể thêm internal note.

**Bước 4 — WH_ADMIN tư vấn / chốt giá**

- Trao đổi với khách qua email/phone (ngoài hệ thống).
- Update thông tin (volume, contract_type, ngày bắt đầu) qua PATCH.

**Bước 5 — APPROVE**

- Click "Approve" → modal xác nhận:
  - Email tenant admin (mặc định lấy từ rental request).
  - Mật khẩu tạm (system gen hoặc admin nhập).
  - Tên contract code (auto generate `CTR-2026-0001`).
- Click confirm:
  1. System tạo `tenant_company`.
  2. System tạo `user` role `TENANT_ADMIN`.
  3. System tạo `contract` (status `DRAFT`).
  4. System gửi email "Welcome + login info" tới tenant admin.
  5. Status rental request → `APPROVED`.

**Bước 6 — Ký contract**

- Trang `/admin/contracts/:contractId/sign`.
- 2 chữ ký số: `tenant_signature_url` (upload tenant), `warehouse_signature_url` (upload WH).
- Khi đủ 2 chữ ký → status `ACTIVE` → rental request → `CONVERTED`.

**Bước 7 — Assign storage reservation**

- Trang `/admin/contracts/:contractId/storage`.
- Chọn `storage_level`: WAREHOUSE / ZONE / RACK / RACK_LEVEL / BIN.
- Chọn vị trí cụ thể tương ứng.
- Loại reservation: `SHARED` / `RESERVED` / `DEDICATED`.
- Save → tenant đã có thể bắt đầu nhập hàng (Flow 4).

**Bước 8 — Tenant admin login lần đầu**

- Vào `/login`, dùng email + mật khẩu tạm trong email.
- Hệ thống prompt đổi mật khẩu (theo flow OTP — section dưới).
- Vào dashboard tenant → thấy contract ACTIVE → bắt đầu tạo SKU.

### 🔌 Endpoint backend liên quan

| Method | Endpoint | Mục đích |
|--------|----------|----------|
| `POST` | `/api/rental-requests` | Guest submit form |
| `GET` | `/api/rental-requests` | WH list |
| `GET` | `/api/rental-requests/:id` | WH chi tiết |
| `PATCH` | `/api/rental-requests/:id` | Update status / note |
| `POST` | `/api/tenants` | Tạo tenant company |
| `POST` | `/api/users` | Tạo TENANT_ADMIN user |
| `POST` | `/api/contracts` | Tạo contract |
| `PATCH` | `/api/contracts/:id` | Update contract (chữ ký, status) |
| `POST` | `/api/contract-items` | Detail từng slot/zone thuê |
| `POST` | `/api/storage-reservations` | Reserve vị trí |
| `POST` | `/api/auth/login` | Tenant login |
| `POST` | `/api/auth/change-password` | Đổi mật khẩu lần đầu (gửi OTP) |
| `POST` | `/api/auth/change-password/verify` | Confirm OTP |

### ⚠️ Edge case & rules

- **Rental request không bắt buộc dẫn tới contract**. Khách có thể bị REJECTED. FE phải show lý do reject (`rejection_reason`).
- **1 rental request → tối đa 1 contract**. Nếu khách quay lại, tạo rental request mới.
- **Contract có thể có nhiều contract_items** — mỗi item là 1 slot/zone/rack thuê riêng.
- **Storage reservation polymorphic**: chỉ điền 1 trong 5 FK (`warehouse_id` / `zone_id` / `rack_id` / `rack_level_id` / `bin_id`) tuỳ `storage_level`.
- **Tenant chỉ ACTIVE khi**: có user TENANT_ADMIN + contract ACTIVE + ít nhất 1 storage_reservation.

### 🎨 Gợi ý màn hình FE

**Public**
- `LandingPage` — hero + form rental request.
- `RentalRequestFormPage` — multi-step form (info → demand → confirmation).
- `RentalRequestSubmittedPage` — thank you + tracking link.

**Admin (WH)**
- `AdminRentalRequestListPage` — table + filter.
- `AdminRentalRequestDetailPage` — info + timeline + actions (review/approve/reject).
- `AdminContractSignPage` — upload chữ ký, preview PDF.
- `AdminStorageAssignPage` — chọn level + location picker (cây hierarchy).

**Tenant**
- `FirstLoginChangePasswordPage` — OTP form.
- `TenantDashboardPage` — overview contract + storage.

---

## Flow 2 — Warehouse Structure

> Quản trị viên thiết lập kho vật lý: tạo zone, rack, level, bin.

### 🎯 Mục tiêu

Mô hình hoá kho thật ngoài đời vào database, để các flow sau (inbound/outbound) tham chiếu được tới ô lưu cụ thể.

### 👤 Actor

- `SYSTEM_ADMIN` — tạo warehouse + assign WH_ADMIN.
- `WH_ADMIN` — tạo zones/racks/levels/bins trong warehouse của mình.

### 📋 Tiền điều kiện

- (System admin) — không cần.

### 🔄 State machine

Warehouse structure không có status flow phức tạp. Chỉ có:

- `Bin.status`: `AVAILABLE`, `OCCUPIED`, `RESERVED`, `BLOCKED`.
- `Bin.is_active`: true/false (soft disable).

### 📱 Step-by-step UI flow

**Bước 1 — Tạo warehouse**

- Trang `/system/warehouses/new`.
- Form: code (`WH-HCM-01`), name, address, city, district, total area (m²).
- Save → ra trang chi tiết.

**Bước 2 — Tạo zone**

- Trong trang warehouse, tab "Zones".
- Click "Add zone".
- Form:
  - Code (`ZONE-A01`).
  - Name (`Zone A — Fast moving`).
  - Type: `SHARED`, `FAST_MOVING`, `BULK`, `PREMIUM`, `QC`, `RETURN`, `AMBIENT`, `COLD`.
  - Area (m²).
  - `is_dedicated` (boolean) — nếu zone dành riêng cho 1 tenant.
- Save.

**Bước 3 — Tạo rack**

- Trong trang zone, tab "Racks".
- Click "Add rack".
- Form:
  - Code (`RACK-A01-01`).
  - Type: `STANDARD`, `HIGH_CAPACITY`.
  - Tổng số level (auto tạo level 1..N hoặc tạo từng cái).
- Save.

**Bước 4 — Tạo rack level**

- Trong trang rack, tab "Levels".
- Auto tạo theo `total_levels` lúc tạo rack.
- Hoặc thêm thủ công: number, height, max capacity.

**Bước 5 — Tạo bin**

- Trong trang rack level, tab "Bins".
- Click "Add bins" — có thể tạo hàng loạt:
  - Pattern: `BIN-{rack_code}-{level}-{##}`.
  - Số lượng: ví dụ 8 bin/level.
  - Box type: `SMALL`, `MEDIUM`, `LARGE`, `EXTRA`.
  - Volume units: SMALL=1, MEDIUM=2, LARGE=4, EXTRA=8.
  - Max LPN count.
  - Shared policy (cho phép nhiều tenant share không).
- Save.

**Bước 6 — Visualize**

- Trang `/admin/warehouses/:id/map` — sơ đồ 2D / 3D của warehouse, click vào bin để xem chi tiết.
- Heatmap occupancy: bin càng đầy → màu càng đậm.

### 🔌 Endpoint backend liên quan

| Method | Endpoint | Mục đích |
|--------|----------|----------|
| `POST` | `/api/warehouses` | Tạo warehouse |
| `GET` | `/api/warehouses` | List |
| `POST` | `/api/zones` | Tạo zone (body có `warehouseId`) |
| `GET` | `/api/zones?warehouseId=` | List zone của warehouse |
| `POST` | `/api/racks` | Tạo rack |
| `POST` | `/api/rack-levels` | Tạo level |
| `POST` | `/api/bins` | Tạo bin (có thể batch) |
| `GET` | `/api/bins?rackLevelId=` | List bin của level |

### ⚠️ Edge case & rules

- **Không xoá warehouse/zone/rack nếu có dữ liệu con**. FE phải show confirm: "Có 25 bin đang chứa hàng, không thể xoá."
- **Đổi `zone.type` từ AMBIENT → COLD** có thể ảnh hưởng SKU đang nằm đó. FE warning trước khi save.
- **Bin status `BLOCKED`** chỉ admin set tay (vd: lỗi vật lý, sửa chữa).
- **Mỗi bin có `volume_units`** — capacity tính theo unit, không phải số LPN.

### 🎨 Gợi ý màn hình FE

- `WarehouseListPage`.
- `WarehouseDetailPage` với tabs: Info / Zones / Stats / Map.
- `ZoneDetailPage` / `RackDetailPage` / `LevelDetailPage` / `BinDetailPage`.
- `WarehouseMapPage` — visualization 2D với react-flow hoặc canvas.
- `BulkBinCreateModal` — tạo nhiều bin cùng lúc.

---

## Flow 3 — SKU Management

> Brand khai báo sản phẩm trước khi nhập kho.

### 🎯 Mục tiêu

Mỗi SKU (Stock Keeping Unit) đại diện 1 đơn vị nhỏ nhất quản lý: ví dụ "Áo thun cổ tròn, màu đỏ, size M, chất cotton 100%".

### 👤 Actor

- `TENANT_ADMIN` — chính.
- `TENANT_STAFF` — tạo SKU thay (nếu được uỷ quyền).

### 📋 Tiền điều kiện

- Tenant đã ACTIVE.
- Có master data: `categories`, `seasons` (do system admin seed).
- (Optional) Có `collection` của tenant.

### 🔄 State machine

SKU không có status complex. Chỉ có `is_active` (boolean).

### 📱 Step-by-step UI flow

**Bước 1 — Master data setup (làm 1 lần)**

`SYSTEM_ADMIN` seed:
- **Category**: Áo, Quần, Đầm, Phụ kiện, ...
- **Season**: SS26, FW26, SS27, ...

`TENANT_ADMIN` tạo:
- **Collection** của tenant: "Summer Collection 2026", "Workwear 2026", ...
  - Mỗi collection gắn với 1 season + 1 tenant.

**Bước 2 — Tạo SKU**

- Trang `/tenant/skus/new`.
- Form:
  - `skuCode`: unique trong tenant (`AT-DO-M`).
  - `name`: "Áo thun cổ tròn đỏ size M".
  - `categoryId`: chọn từ dropdown.
  - `collectionId`: chọn từ tenant's collections.
  - `seasonId`: chọn season.
  - Attribute: color, size, material.
  - `movement_category`: `FAST_MOVING`, `MEDIUM_MOVING`, `SLOW_MOVING` (ảnh hưởng giá lưu kho).
  - Upload ảnh (qua Cloudinary).
  - Unit weight (gram).
  - Unit volume (cm³).
- Save.

**Bước 3 — Bulk import**

- Trang `/tenant/skus/import`.
- Upload CSV/Excel mẫu.
- Preview + validate row by row.
- Confirm import → tạo hàng loạt.

**Bước 4 — Quản lý SKU**

- Trang `/tenant/skus`.
- Filter: collection, season, movement category, active/inactive.
- Search by code/name.
- Click vào SKU → chi tiết + lịch sử inbound/outbound.

### 🔌 Endpoint backend liên quan

| Method | Endpoint | Mục đích |
|--------|----------|----------|
| `GET` | `/api/categories` | List category (master) |
| `GET` | `/api/seasons` | List season (master) |
| `POST` | `/api/collections` | Tạo collection của tenant |
| `GET` | `/api/collections?tenantId=` | List collection |
| `POST` | `/api/skus` | Tạo SKU |
| `GET` | `/api/skus?tenantId=&collectionId=` | List + filter |
| `PATCH` | `/api/skus/:skuId` | Update |
| `DELETE` | `/api/skus/:skuId` | Soft disable |

### ⚠️ Edge case & rules

- **`skuCode` unique trong scope tenant** — 2 tenant có thể trùng SKU code không sao.
- **Không thể xoá SKU đã có inventory** — FE block.
- **`movement_category`** ảnh hưởng giá: FAST_MOVING +20-40% (xem `docs/pricing.md`).
- **Ảnh SKU** lưu trên Cloudinary, BE chỉ lưu URL.

### 🎨 Gợi ý màn hình FE

- `SkuListPage` — grid view (thumbnail) hoặc table.
- `SkuDetailPage` — info + history (inbound/outbound).
- `SkuFormPage` — create / edit.
- `SkuImportPage` — bulk CSV.
- `CollectionListPage`.

---

## Flow 4 — Inbound (Nhập kho)

> **CRITICAL flow** — Brand ship hàng tới warehouse và warehouse nhập vào hệ thống.

### 🎯 Mục tiêu

Đưa hàng từ "trên đường tới kho" vào "đã yên vị trong bin", đầy đủ traceability.

### 👤 Actor

- `TENANT_ADMIN` / `TENANT_STAFF` — tạo inbound request.
- `WH_ADMIN` — duyệt request.
- `WH_STAFF` — receive, scan, put-away.

### 📋 Tiền điều kiện

- Tenant có contract `ACTIVE`.
- Contract khớp tenant + warehouse muốn nhập.
- SKU đã được tạo (Flow 3).
- (Optional) AI service đã chạy để có recommendation.

### 🔄 State machine — `inbound_requests.status`

```
   DRAFT (chưa submit)
     │
     ▼
   PENDING ← Tenant submit
     │
     ▼
   APPROVED ← WH duyệt
     │
     ▼
   ARRIVED ← Truck tới kho
     │
     ▼
   RECEIVING ← WH staff bắt đầu unload
     │
     ▼
   COMPLETED ← Put-away xong, inventory ghi nhận
     │
     ▼ (rẽ nhánh bất kỳ giai đoạn)
   CANCELLED
```

### 📱 Step-by-step UI flow

**Bước 1 — Tenant tạo inbound request**

- Trang `/tenant/inbounds/new`.
- Form:
  - `contractId`: chọn từ contract ACTIVE (auto fill nếu chỉ có 1).
  - `warehouseId`: lấy từ contract.
  - `expectedArrivalDate`: ngày dự kiến hàng tới.
  - Carrier info (tên hãng vận chuyển, số xe, tài xế) — optional.
  - Items:
    - SKU (dropdown từ tenant's SKUs).
    - Expected quantity.
- Lưu draft hoặc submit ngay → status `PENDING`.

**Bước 2 — WH admin review**

- Trang `/wh/inbounds?status=PENDING`.
- Click → chi tiết.
- Action:
  - Approve → `APPROVED`.
  - Reject với reason → `CANCELLED`.

**Bước 3 — Hàng tới**

- WH staff bấm "Mark arrived" → status `ARRIVED`.
- (Trong mobile app) Scan QR/barcode của shipment để mark.

**Bước 4 — Receiving**

- Click "Start receiving" → status `RECEIVING`.
- WH staff đếm thực tế từng SKU:
  - Update `received_quantity` cho từng item.
  - `discrepancy_quantity = received - expected` (có thể âm).
  - Note discrepancy reason.

**Bước 5 — Tạo batch**

- 1 inbound → tạo 1 batch (hoặc nhiều batch nếu chia lô).
- Batch lưu `warehouse_received_at` (timestamp) — dùng cho FIFO sau này.

**Bước 6 — Tạo LPN (carton)**

- Mỗi LPN là 1 carton vật lý, chứa nhiều SKU.
- Form:
  - `boxType`: SMALL/MEDIUM/LARGE/EXTRA.
  - `volumeUnits`: tự fill theo type.
  - Items: SKU + quantity trong LPN này.
- Tạo nhiều LPN cùng lúc nếu cần.
- System gen `lpnCode` (`LPN-2026-00123`) + in nhãn dán.

**Bước 7 — AI recommendation (optional)**

- Sau khi LPN tạo, FE gọi `/api/lpns/:lpnId/rack-suggestion?warehouseId=`.
- BE / AI service trả về list rack đề xuất + score + lý do.
- WH staff có thể accept hoặc chọn manual.

**Bước 8 — Put-away**

- Trong mobile app:
  - Scan LPN code.
  - Scan bin code đích.
  - Confirm.
- System:
  - Update `lpn.currentBinId`.
  - Tạo `inventory_movement` type `PUTAWAY`.
  - Update `inventories` (cộng vào tồn kho theo bin).
  - Update `bin.usedVolumeUnits`.

**Bước 9 — Complete**

- Khi tất cả LPN đã put-away → status inbound → `COMPLETED`.
- Email notification tenant.

### 🔌 Endpoint backend liên quan

| Method | Endpoint | Mục đích |
|--------|----------|----------|
| `POST` | `/api/inbound-requests` | Tạo |
| `GET` | `/api/inbound-requests?status=&tenantId=` | List + filter |
| `GET` | `/api/inbound-requests/:id` | Detail |
| `PATCH` | `/api/inbound-requests/:id` | Update status |
| `POST` | `/api/batches` | Tạo batch |
| `POST` | `/api/lpns` | Tạo LPN |
| `POST` | `/api/lpn-details` | Tạo chi tiết SKU trong LPN |
| `GET` | `/api/lpns/:lpnId/details` | List SKU của LPN |
| `GET` | `/api/lpns/:lpnId/rack-suggestion?warehouseId=` | AI gợi ý |
| `PATCH` | `/api/lpns/:lpnId` | Update currentBinId (put-away) |

### ⚠️ Edge case & rules

- **Inbound chỉ tạo được khi contract ACTIVE** — BE check, FE disable button nếu contract DRAFT/EXPIRED.
- **Discrepancy**: nếu received < expected → cần ghi nhận lý do (damaged/lost/extra).
- **LPN không gắn bin** → status LPN = `RECEIVING`. Sau put-away → `STORED`.
- **Không thể xoá inbound request đã COMPLETED**.
- **Cancel chỉ áp dụng trước RECEIVING** — sau đó phải xử lý theo flow damage/return.

### 🎨 Gợi ý màn hình FE

**Tenant**
- `TenantInboundListPage`.
- `TenantInboundNewPage` — form với SKU picker.
- `TenantInboundDetailPage` — timeline + items.

**WH Admin**
- `WhInboundListPage` — kanban board theo status.
- `WhInboundDetailPage` với actions (approve/reject).

**WH Staff (mobile)**
- `MobileScanArrivalPage` — quét QR shipment.
- `MobileReceivingPage` — đếm từng SKU.
- `MobileLpnCreatePage` — tạo carton.
- `MobilePutAwayPage` — scan LPN + scan bin.

---

## Flow 5 — Inventory Management

> Quản lý tồn kho real-time với khả năng truy nguyên 4 chiều: SKU × Batch × LPN × Bin.

### 🎯 Mục tiêu

Mọi lúc đều biết:
- 1 SKU có bao nhiêu units, ở bin nào.
- 1 bin chứa gì.
- 1 LPN ở đâu, chứa gì.
- 1 batch còn lại bao nhiêu (FIFO).

### 👤 Actor

- `TENANT_ADMIN/STAFF` — xem tồn kho của tenant mình.
- `WH_ADMIN/STAFF` — xem toàn warehouse.

### 📋 Tiền điều kiện

- Đã có inbound COMPLETED.

### 🔄 State machine

Inventory không có status nghiệp vụ. `inventory.status` chỉ có:
- `AVAILABLE` — có thể bán.
- `RESERVED` — đã reserve cho outbound nhưng chưa pick.
- `DAMAGED` — hỏng, không bán được.
- `QUARANTINE` — đang kiểm tra.

### 📱 Step-by-step UI flow

**Tenant view**

- Trang `/tenant/inventory`.
- Filter:
  - SKU.
  - Status (available / reserved).
  - Warehouse.
  - Batch (FIFO age).
- Hiển thị: tổng tồn / available / reserved.
- Click vào row SKU → drill down theo bin/LPN/batch.

**WH staff view**

- Trang `/wh/inventory`.
- Filter thêm: tenant, zone, rack, bin, LPN.
- Map view: heatmap occupancy theo zone.

**Realtime updates**

- WebSocket (sẽ làm) push event khi:
  - `INVENTORY_INCREASED` (sau put-away).
  - `INVENTORY_DECREASED` (sau picking).
  - `INVENTORY_RESERVED` (sau outbound approve).
- FE update row mà không cần refresh.

### 🔌 Endpoint backend liên quan

(Endpoint inventory chi tiết sẽ thêm sau — hiện thông qua `lpn-details` + `bins`.)

| Method | Endpoint | Mục đích |
|--------|----------|----------|
| `GET` | `/api/lpns?tenantId=&status=STORED` | List LPN tồn kho |
| `GET` | `/api/lpns/:lpnId/details` | Chi tiết SKU trong LPN |
| `GET` | `/api/bins?warehouseId=` | List bins + occupancy |

### ⚠️ Edge case & rules

- **Tenant chỉ thấy data của mình** (BE filter theo `req.user.tenantId`).
- **`available = total - reserved - damaged - quarantine`**.
- **FIFO**: khi xuất, system tự chọn batch cũ nhất trước.

### 🎨 Gợi ý màn hình FE

- `InventoryDashboardPage` — số liệu tổng + charts.
- `InventoryTablePage` — table với filter mạnh.
- `InventoryDrilldownPage` — cây SKU → batch → LPN → bin.
- `InventoryMovementLogPage` — audit log mọi movement.

---

## Flow 6 — Storage Reservation

> Quyết định cách hàng được phân bổ vào kho: shared, reserved, dedicated.

### 🎯 Mục tiêu

Match nhu cầu tenant với capacity warehouse theo 5 mức:
- **WAREHOUSE** — tenant thuê nguyên kho.
- **ZONE** — thuê nguyên zone.
- **RACK** — thuê nguyên rack.
- **RACK_LEVEL** — thuê 1 tầng.
- **BIN** — thuê từng bin.

### 👤 Actor

- `WH_ADMIN` — assign reservation sau khi contract sign.
- `TENANT_ADMIN` — xem reservation của mình (read-only).

### 📋 Tiền điều kiện

- Contract `ACTIVE`.
- Capacity còn trống ở level tương ứng.

### 🔄 State machine

Reservation không có status phức tạp. Có `is_active` (boolean).

### 📱 Step-by-step UI flow

**WH_ADMIN tạo reservation**

- Vào trang contract detail.
- Tab "Storage" → "Add reservation".
- Form:
  - `storageLevel`: WAREHOUSE / ZONE / RACK / RACK_LEVEL / BIN.
  - **FK tương ứng**: chỉ điền 1 trong 5.
  - `reservationType`: `SHARED` / `RESERVED` / `DEDICATED`.
  - `quantity`: số bin / m² / rack tuỳ level.
  - `startDate`, `endDate` (mặc định lấy từ contract).
- Save.

### 🔌 Endpoint backend liên quan

| Method | Endpoint | Mục đích |
|--------|----------|----------|
| `POST` | `/api/storage-reservations` | Tạo |
| `GET` | `/api/storage-reservations?contractId=` | List |
| `PATCH` | `/api/storage-reservations/:id` | Update |
| `DELETE` | `/api/storage-reservations/:id` | Xoá (chỉ khi chưa có inventory) |

### ⚠️ Edge case & rules

- **Polymorphic**: chỉ điền 1 trong 5 FK. BE validate.
- **`DEDICATED`** → không thể assign cho tenant khác cùng lúc.
- **`SHARED`** → cho phép nhiều tenant share cùng bin/rack.
- **Khi contract EXPIRED** → tự động deactivate reservation.

### 🎨 Gợi ý màn hình FE

- `ContractStorageTab` — list + form.
- `StorageLevelPicker` — cây hierarchy có disable node đã full.
- `StorageReservationOverview` — visualization theo warehouse map.

---

## Flow 7 — Outbound (Xuất kho)

> **CRITICAL flow** — Brand xuất hàng từ warehouse đi tới khách / cửa hàng.

### 🎯 Mục tiêu

Từ "tenant cần xuất 100 áo size M" tới "100 áo đã giao thành công".

### 👤 Actor

- `TENANT_ADMIN/STAFF` — tạo outbound.
- `WH_ADMIN` — duyệt.
- `WH_STAFF` — pick / pack / ship.

### 📋 Tiền điều kiện

- Tenant có contract ACTIVE.
- Có đủ inventory (`available >= requested`).

### 🔄 State machine — `outbound_requests.status`

```
   DRAFT
     │
     ▼
   PENDING ← Tenant submit
     │
     ▼
   APPROVED ← WH duyệt
     │
     ▼
   RESERVED ← System lock inventory (FIFO)
     │
     ▼
   PICKING ← Staff bắt đầu pick
     │
     ▼
   PACKING ← Pick xong, đang đóng gói
     │
     ▼
   SHIPPED ← Đã giao cho carrier
     │
     ▼
   COMPLETED ← Khách nhận
     │
     ▼ (rẽ nhánh)
   CANCELLED
```

### 📱 Step-by-step UI flow

**Bước 1 — Tenant tạo outbound request**

- Trang `/tenant/outbounds/new`.
- Form:
  - `contractId`, `warehouseId`.
  - `requestedShipDate`.
  - Carrier info (tên hãng, mã vận đơn dự kiến).
  - Destination address.
  - Items:
    - SKU.
    - Requested quantity.
- Submit → `PENDING`.

**Bước 2 — WH duyệt**

- WH admin review.
- Check inventory available.
- Approve → `APPROVED`.

**Bước 3 — Reserve inventory (FIFO)**

- System tự chạy:
  - Với mỗi SKU, query inventory available theo batch tăng dần `warehouse_received_at`.
  - Lock số lượng cần thiết → `inventory.reserved_quantity` tăng.
- Status → `RESERVED`.

**Bước 4 — Tạo picking task**

- 1 outbound → có thể có nhiều picking task (chia cho nhiều staff).
- Mỗi task chứa các `picking_task_items` cụ thể: pick từ LPN nào, bin nào, qty bao nhiêu.

**Bước 5 — Picking**

- Mobile app cho WH staff.
- Hiển thị danh sách "task của tôi".
- Click task → list item.
- Cho mỗi item:
  - Navigate tới bin (có map mini).
  - Scan bin → confirm location.
  - Scan LPN → confirm.
  - Nhập quantity picked.
  - Confirm.
- Status outbound → `PICKING`.

**Bước 6 — Packing**

- Bring tới khu pack.
- Đóng vào carton xuất.
- Cân, dán nhãn shipping.
- Mark complete → `PACKING` → `SHIPPED`.

**Bước 7 — Shipment**

- Tạo `shipment` record:
  - `shipmentCode`.
  - `carrierName`.
  - `trackingNumber`.
  - `shippedAt`.
- Status outbound → `SHIPPED`.

**Bước 8 — Delivery confirmed**

- Khi carrier báo delivered → manual update hoặc webhook.
- Status `COMPLETED`.
- Email tenant.

### 🔌 Endpoint backend liên quan

| Method | Endpoint | Mục đích |
|--------|----------|----------|
| `POST` | `/api/outbound-requests` | Tạo |
| `GET` | `/api/outbound-requests?status=` | List |
| `GET` | `/api/outbound-requests/:id` | Detail |
| `PATCH` | `/api/outbound-requests/:id` | Update status / approver |
| `DELETE` | `/api/outbound-requests/:id` | Xoá (chỉ DRAFT/PENDING) |
| (sắp có) | `/api/picking-tasks` | CRUD picking tasks |
| (sắp có) | `/api/shipments` | CRUD shipments |

### ⚠️ Edge case & rules

- **Không tạo được outbound nếu inventory available không đủ** — BE return error 400 `INSUFFICIENT_INVENTORY`.
- **FIFO bắt buộc** — không cho phép chọn batch mới hơn nếu batch cũ còn.
- **Cancel chỉ trước PICKING** — sau đó phải hoàn tác inventory thủ công.
- **Partial fulfillment** — có thể pick được 80 / 100, mark `PARTIAL` (sẽ thêm enum).

### 🎨 Gợi ý màn hình FE

**Tenant**
- `TenantOutboundListPage`.
- `TenantOutboundNewPage`.
- `TenantOutboundDetailPage` — tracking timeline.

**WH Admin**
- `WhOutboundListPage` — kanban / table.
- `WhOutboundDetailPage` — approve/reject.

**WH Staff (mobile)**
- `MobilePickingTaskListPage`.
- `MobilePickingExecutePage` — scan + counting.
- `MobilePackingPage`.
- `MobileShipmentCreatePage`.

---

## Flow 8 — Billing & Invoice

> Tự động tính phí lưu kho theo usage + handling.

### 🎯 Mục tiêu

Cuối kỳ (tháng / năm) gen invoice cho tenant dựa trên:
- Storage usage (theo hợp đồng SHARED / RESERVED / DEDICATED).
- Handling fee (inbound/outbound/relocation/QC).
- Surcharge (FAST_MOVING, PREMIUM ZONE, ...).

### 👤 Actor

- **System (cron job)** — auto gen daily/monthly.
- `WH_ADMIN` — review + send invoice.
- `TENANT_ADMIN` — xem + thanh toán.

### 📋 Tiền điều kiện

- Tenant có contract.
- Có pricing policy.
- Có activity (inbound/outbound/storage usage).

### 🔄 State machine — `invoices.payment_status`

```
   PENDING (vừa gen)
     │
     ├──→ PAID (khách trả đủ)
     │
     └──→ OVERDUE (quá hạn)
```

`payments.payment_status`: `PENDING` → `SUCCESS` / `FAILED`.

### 📱 Step-by-step UI flow

**Bước 1 — Daily snapshot (cron)**

- Mỗi đêm, system chạy:
  - Query mỗi tenant: số bin đang dùng, theo box type, theo zone.
  - Lưu vào `storage_usage_snapshots` (1 row / tenant / ngày).

**Bước 2 — Monthly invoice gen (cron)**

- Đầu mỗi tháng, system gen invoice cho tháng trước:
  - Tính phí storage: tổng snapshot × rate × số ngày.
  - Tính phí handling: count inbound/outbound LPN × fee.
  - Cộng surcharge.
  - Tạo `invoices` + `invoice_items` chi tiết.

**Bước 3 — WH admin review**

- Trang `/admin/invoices?status=PENDING`.
- Click → preview invoice detail.
- Có thể adjust (add discount, note).
- "Send to tenant" → email.

**Bước 4 — Tenant xem & thanh toán**

- Trang `/tenant/invoices`.
- Click invoice → detail + download PDF.
- Click "Pay" → cổng thanh toán (chưa tích hợp).
- Hoặc upload bằng chứng chuyển khoản.

**Bước 5 — Payment confirmed**

- WH admin confirm payment manual.
- Status invoice → `PAID`.
- Email confirmation.

### 🔌 Endpoint backend liên quan

(Sẽ thêm. Hiện tại tables đã có nhưng chưa expose API.)

### ⚠️ Edge case & rules

- **Pricing model**: `USAGE_BASED` / `FIXED` / `HYBRID` (xem `docs/pricing.md`).
- **Reserved storage** vẫn bill kể cả không dùng.
- **Dedicated zone/warehouse** bill theo m² / tháng cố định.
- **Shared storage** bill theo usage trung bình kỳ (không snapshot ngày trên UI guest).

### 🎨 Gợi ý màn hình FE

- `BillingDashboardPage` — usage chart, projected invoice.
- `InvoiceListPage`.
- `InvoiceDetailPage` — bảng chi tiết line items.
- `InvoicePDFPreviewPage`.
- `PaymentUploadPage` — upload bằng chứng.

---

## Flow 9 — AI Recommendation

> Gợi ý vị trí lưu trữ tối ưu cho LPN sắp put-away.

### 🎯 Mục tiêu

Giảm thời gian put-away + tối ưu picking sau này.

### 👤 Actor

- **AI service** (external, Python) — sinh recommendation.
- `WH_STAFF` — xem + accept/reject.

### 📋 Tiền điều kiện

- LPN đã tạo.
- AI service đang chạy.

### 🔄 State machine

`ai_slot_recommendations.is_applied`: false → true (sau khi staff accept).

### 📱 Step-by-step UI flow

**Bước 1 — Tạo LPN** (Flow 4 step 6)

**Bước 2 — Gọi AI**

- BE tự động hoặc FE chủ động gọi: `GET /api/lpns/:lpnId/rack-suggestion?warehouseId=`.
- AI return:
  - List rack ranked theo score.
  - Reason: "Same zone as previous batch", "Near outbound dock", ...

**Bước 3 — Staff quyết định**

- UI hiển thị top 3 gợi ý + map.
- Click "Accept" → đi tới bin → put-away.
- Hoặc "Choose other" → manual search bin → put-away.

**Bước 4 — Track**

- `ai_slot_recommendations.is_applied = true` nếu staff accept.
- Dùng cho training feedback loop.

### 🔌 Endpoint backend liên quan

| Method | Endpoint | Mục đích |
|--------|----------|----------|
| `GET` | `/api/lpns/:lpnId/rack-suggestion?warehouseId=` | AI gợi ý |
| (chưa) | `/api/ai-recommendations` | History |

### ⚠️ Edge case & rules

- **AI không quyết định FIFO** — chỉ recommend vị trí put-away.
- **AI không auto allocate outbound** — staff vẫn confirm.
- **Fallback**: nếu AI service down → BE return list rack mặc định (zone matching).

### 🎨 Gợi ý màn hình FE

- `LpnPutAwayRecommendationPage` — top 3 cards với map preview.
- `AiRecommendationHistoryPage` — analytics dashboard.

---

## Flow 10 — Occupancy Monitoring

> Real-time / snapshot occupancy của warehouse.

### 🎯 Mục tiêu

Cho WH admin biết kho đầy đến đâu, zone nào hot, để quyết định mở thêm kho / sale storage.

### 👤 Actor

- `WH_ADMIN`.
- `SYSTEM_ADMIN`.

### 📋 Tiền điều kiện

- Có inventory.

### 🔄 State machine

Không có.

### 📱 Step-by-step UI flow

- Dashboard `/admin/occupancy`:
  - Card tổng quan: % occupied warehouse.
  - Per zone: bar chart.
  - Heatmap: zone × time (7 ngày).
  - List bin gần đầy: > 90%.

### 🔌 Endpoint backend liên quan

(Tables có sẵn `occupancy_snapshots`, `bins.used_volume_units`. API expose sau.)

### ⚠️ Edge case & rules

- Snapshot daily — không realtime.

### 🎨 Gợi ý màn hình FE

- `OccupancyDashboard`.
- `WarehouseMapHeatmap`.

---

## Flow 11 — Reporting

> Export báo cáo định kỳ.

### 🎯 Mục tiêu

Báo cáo tháng / quý: inventory, throughput, billing, occupancy.

### 👤 Actor

- `WH_ADMIN` / `SYSTEM_ADMIN` / `TENANT_ADMIN`.

### 📱 Step-by-step UI flow

- Trang `/reports`.
- Chọn loại: inventory / inbound / outbound / billing / occupancy.
- Filter: date range, tenant, warehouse.
- Preview → Export CSV / Excel / PDF.

### 🔌 Endpoint backend liên quan

(Sẽ thêm.)

### 🎨 Gợi ý màn hình FE

- `ReportsHubPage` — list các loại báo cáo.
- `ReportPreviewPage`.

---

## Flow 12 — Inventory Relocation

> Chuyển hàng giữa các bin trong warehouse.

### 🎯 Mục tiêu

Tối ưu lại vị trí (vd: hàng SLOW_MOVING từ zone PREMIUM → BULK).

### 👤 Actor

- `WH_STAFF`.

### 📱 Step-by-step UI flow

- Mobile app:
  - Scan LPN source.
  - Scan bin destination.
  - Confirm.
- BE:
  - Update `lpn.currentBinId`.
  - Tạo `inventory_movements` type `RELOCATION`.

### 🎨 Gợi ý màn hình FE

- `MobileRelocationPage`.

---

## Flow 13 — Damage Handling

> Xử lý hàng hỏng.

### 🎯 Mục tiêu

Ghi nhận hàng damaged để (1) trừ inventory available, (2) báo tenant, (3) tách ra zone QC/RETURN.

### 👤 Actor

- `WH_STAFF`.

### 📱 Step-by-step UI flow

- Scan LPN.
- Mark damaged (quantity + photo + reason).
- BE:
  - `inventory.status = DAMAGED`.
  - Move LPN tới zone `QC` hoặc `RETURN`.
  - Notify tenant.

### 🎨 Gợi ý màn hình FE

- `MobileDamageReportPage` — camera upload.

---

# Phần C — Cheat sheet cho FE

## C1. Mapping flow → màn hình

| Flow | Màn hình chính | Role |
|------|----------------|------|
| 1. Tenant onboarding | LandingPage, RentalRequestForm | Guest |
| 1. Tenant onboarding | RentalRequestList, ContractSign | WH_ADMIN |
| 2. Warehouse structure | WarehouseDetail, WarehouseMap | SYSTEM/WH_ADMIN |
| 3. SKU management | SkuList, SkuForm, SkuImport | TENANT |
| 4. Inbound | TenantInboundList, TenantInboundNew | TENANT |
| 4. Inbound | WhInboundList, WhInboundDetail | WH_ADMIN |
| 4. Inbound | MobileReceiving, MobilePutAway | WH_STAFF |
| 5. Inventory | InventoryDashboard, InventoryTable | ALL |
| 6. Reservation | ContractStorageTab | WH_ADMIN |
| 7. Outbound | TenantOutboundList, TenantOutboundNew | TENANT |
| 7. Outbound | WhOutboundList, MobilePicking | WH |
| 8. Billing | InvoiceList, InvoiceDetail | ALL |
| 9. AI | LpnPutAwayRecommendation | WH_STAFF |
| 10. Occupancy | OccupancyDashboard | WH_ADMIN |
| 11. Reporting | ReportsHub | ALL |
| 12. Relocation | MobileRelocation | WH_STAFF |
| 13. Damage | MobileDamageReport | WH_STAFF |

## C2. State machine summary

### Rental Request

```
PENDING → UNDER_REVIEW → APPROVED → CONVERTED
                       ↘ REJECTED
```

### Contract

```
DRAFT → ACTIVE → EXPIRED
              ↘ TERMINATED
```

### Inbound Request

```
DRAFT → PENDING → APPROVED → ARRIVED → RECEIVING → COMPLETED
                                                  ↘ CANCELLED
```

### Outbound Request

```
DRAFT → PENDING → APPROVED → RESERVED → PICKING → PACKING → SHIPPED → COMPLETED
                                                                     ↘ CANCELLED
```

### LPN

```
EMPTY → RECEIVING → STORED → PICKING → SHIPPED → EMPTY_RETURNED
```

### Bin

```
AVAILABLE ↔ OCCUPIED ↔ RESERVED
        ↘ BLOCKED (manual)
```

### Invoice

```
PENDING → PAID
       ↘ OVERDUE
```

## C3. Permission matrix

| Resource | SYS_ADMIN | WH_ADMIN | WH_STAFF | TENANT_ADMIN | TENANT_STAFF |
|----------|-----------|----------|----------|--------------|--------------|
| Warehouse CRUD | ✅ | ❌ (only their WH) | ❌ | ❌ | ❌ |
| Zone/Rack/Bin CRUD | ✅ | ✅ | ❌ | ❌ | ❌ |
| Rental request list | ✅ | ✅ | ❌ | own | own |
| Rental request approve | ✅ | ✅ | ❌ | ❌ | ❌ |
| Tenant company CRUD | ✅ | view | ❌ | own | view |
| Contract CRUD | ✅ | ✅ | ❌ | view own | view |
| SKU CRUD | view | view | ❌ | ✅ own | ✅ own |
| Inbound create | ❌ | ❌ | ❌ | ✅ | ✅ |
| Inbound approve | ✅ | ✅ | ❌ | ❌ | ❌ |
| Inbound receive | ❌ | ❌ | ✅ | ❌ | ❌ |
| LPN create | ❌ | ❌ | ✅ | ❌ | ❌ |
| Put-away | ❌ | ❌ | ✅ | ❌ | ❌ |
| Inventory view | all | own WH | own WH | own | own |
| Outbound create | ❌ | ❌ | ❌ | ✅ | ✅ |
| Outbound approve | ✅ | ✅ | ❌ | ❌ | ❌ |
| Picking | ❌ | ❌ | ✅ | ❌ | ❌ |
| Invoice view | all | own WH | ❌ | own | own |
| Reports | ✅ | own WH | ❌ | own | own |

## C4. Form validation reference

### Common

| Field | Rule |
|-------|------|
| Email | regex chuẩn, lowercase trước khi submit |
| Phone (VN) | regex `^(0\|\+84)[0-9]{9,10}$` |
| Password | ≥ 8 ký tự, ít nhất 1 chữ hoa, 1 số |
| UUID | regex UUID v4 |
| Date | ISO 8601, ngày kết thúc > ngày bắt đầu |
| Money (VND) | int ≥ 0 |
| Quantity | int ≥ 1 |
| SKU code | `^[A-Z0-9-]{3,50}$` (uppercase) |

### Rental request

- `companyName` required, ≤ 255.
- `taxCode` 10–13 ký tự số (VN tax code).
- `estimatedVolume` > 0.
- `contractType` ∈ enum.

### Inbound items

- `expectedQuantity` ≥ 1.
- `receivedQuantity` (PATCH) ≥ 0, ≤ `expectedQuantity` × 1.1 (cho phép dư ≤ 10%).

### LPN

- `boxType` ∈ enum.
- `volumeUnits` auto fill từ boxType.
- Tổng SKU quantity ≤ `maxCapacity` của box.

### Outbound items

- `requestedQuantity` ≥ 1.
- FE check trước: `requestedQuantity ≤ inventoryAvailable[skuId]` → show error.

## C5. Empty state & loading state

| State | UX guidance |
|-------|-------------|
| Loading list lần đầu | Skeleton rows (5-10). |
| Loading khi đổi filter | Spinner overlay nhẹ, giữ data cũ mờ. |
| Empty list (chưa có data) | Illustration + CTA "Tạo mới". |
| Empty list (do filter) | "Không tìm thấy. Thử xoá filter." |
| Error 4xx | Toast warning + message từ `body.message`. |
| Error 5xx | Full-page error + "Thử lại" + report link. |
| Network offline | Banner đỏ trên đầu, disable mutation. |
| Optimistic update | UI update ngay, rollback nếu fail. |

---

# Phần D — Demo script

Để demo capstone trong 15 phút, gợi ý kịch bản:

### Phần 1 (2 phút) — Setup

- Mở Swagger → cho thấy có ~50 endpoint.
- Mở DB tool → show 24 tables, 10 enum.

### Phần 2 (3 phút) — Tenant Onboarding (Flow 1)

- Vào landing page (guest).
- Submit rental request "Brand X muốn thuê SHARED_STORAGE, 50m³".
- Login WH_ADMIN → vào /admin/rental-requests.
- Mark "Under review" → "Approve".
- Show tenant_company + contract + user TENANT_ADMIN được tạo.

### Phần 3 (3 phút) — Tenant tự setup (Flow 3)

- Login tenant admin.
- Đổi password (OTP qua email — show inbox real).
- Vào /tenant/skus → tạo 3 SKU mẫu.

### Phần 4 (3 phút) — Inbound (Flow 4) — CRITICAL

- Tenant tạo inbound request 100 áo + 50 quần.
- WH admin approve.
- WH staff mobile: scan arrival → tạo 5 LPN.
- AI gợi ý → put-away vào bin.
- Show inventory updated.

### Phần 5 (3 phút) — Outbound (Flow 7) — CRITICAL

- Tenant tạo outbound 30 áo.
- WH admin approve → system FIFO reserve.
- WH staff pick → pack → ship.
- Show inventory deducted.

### Phần 6 (1 phút) — Reporting

- Show occupancy dashboard.
- Show billing snapshot.

### Phần 7 (Q&A)

- "Tại sao FIFO?" → fashion có expiry mềm (out of season).
- "Multi-tenant isolation?" → JWT + `tenantId` filter.
- "AI làm gì?" → recommendation, không quyết định FIFO.

---

> **Khi nào cập nhật file này?**
> - Mỗi khi thêm flow mới hoặc đổi status enum.
> - Mỗi khi đổi shape response của API liên quan.
> - Tối thiểu: mỗi sprint review.

> **Người chịu trách nhiệm**: Team Lead BE + Team Lead FE đồng sửa.

> **Nguồn truth**: `docs/flow.md` (nghiệp vụ thuần) + `docs/db4.md` (schema) + `docs/request.md` (API contract).
