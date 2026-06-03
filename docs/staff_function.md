# Chức năng & API — Warehouse Staff & Tenant Staff

> **Mục đích**: Ghi nhận **hiện trạng** quyền và API mà `WH_STAFF` (nhân viên kho) và `TENANT_STAFF` (nhân viên brand) có thể dùng.  
> **Cập nhật**: 2026-06-03  
> **Nguồn**: `src/routes/*`, `src/utils/inboundAccess.js`, `src/services/inboundDelivery.service.js`, `docs/all_role_func.md`, `docs/test1.md`, FE `Warehouse_Web_FE`.

**Role code**

| Role | Mã | Phạm vi |
|------|-----|---------|
| Warehouse Staff | `WH_STAFF` | Một `warehouseId` (kế thừa từ WH Admin khi tạo account) |
| Tenant Staff | `TENANT_STAFF` | Một `tenantId` (kế thừa từ Tenant Admin) |

**Home FE sau login**: `/staff/dashboard` (cả hai role).

---

## 1. Xác thực chung (cả hai role)

| Chức năng | API | Ghi chú |
|-----------|-----|---------|
| Đăng nhập | `POST /api/auth/login` | Public |
| Quên mật khẩu | `POST /api/auth/forgot-password`, `POST /api/auth/forgot-password/verify` | Public |
| Đổi mật khẩu | `POST /api/auth/change-password` | Bearer bắt buộc |
| Hồ sơ của mình | `GET /api/users/me`, `PATCH /api/users/me` | Bearer bắt buộc |

**Không dùng được**

| API | Lý do |
|-----|--------|
| `GET/POST/PATCH /api/users` (trừ `/me`) | `authorize` chỉ cho `SYSTEM_ADMIN`, `WH_ADMIN`, `TENANT_ADMIN` |
| `POST /api/users` tạo account | Chỉ admin tạo staff |

---

## 2. Warehouse Staff (`WH_STAFF`)

### 2.0. Mobile scan (Code128)

| API | Mô tả |
|-----|--------|
| `GET /api/scan/resolve?value=...` | Sau khi quét tem Code128 — trả `entityType` + bản ghi (inbound/outbound/LPN/SKU/bin/batch) |
| `POST /api/scan/resolve` | Cùng logic, body `{ value }` |

- **In tem**: encode chuỗi business code (`inboundCode`, `lpnCode`, `outboundCode`, `binCode`, `skuCode`) — symbology **Code 128**.
- Chi tiết: [`docs/barcode-mobile.md`](barcode-mobile.md).

### 2.1. Nghiệp vụ chính (theo thiết kế)

| # | Chức năng | Trạng thái |
|---|-----------|------------|
| 48 | Đánh dấu xe đến kho (inbound `ARRIVED`, `TENANT_SELF`) | ✅ |
| 49 | Nhận hàng & ghi `receivedQuantity` | ✅ |
| 50 | Tạo batch & LPN | ✅ |
| 51 | Put-away LPN vào bin | ✅ |
| 52 | Picking outbound | ⏳ (API outbound có, chưa có UI staff) |
| 53 | Pack & tạo shipment | ⏳ |
| 54 | Báo hàng hư | ❌ (ghi discrepancy lúc receiving) |
| 55 | Xem tồn kho kho | ✅ (một phần — xem mục API) |

**FE routes** (`StaffSidebarNav`)

| Màn hình | Path |
|----------|------|
| Dashboard | `/staff/dashboard` |
| Vận hành nhập kho | `/staff/inbound-ops`, `/staff/inbound-ops/:inboundRequestId` |
| Tồn kho | `/staff/inventory-ops` |
| Quản lý vận chuyển | `/staff/requests` — **mock data**, chưa gọi API |

### 2.2. API theo nhóm

#### A. Kho & cấu trúc (đọc / lập kế hoạch)

Các route sau có `authenticate` + `authorize` rõ ràng:

| Method | API | WH_STAFF |
|--------|-----|----------|
| GET | `/api/warehouses` | ✅ (reader) |
| GET | `/api/warehouses/:warehouseId` | ✅ (trong scope kho) |
| GET | `/api/warehouses/:warehouseId/zone-planning` | ✅ |
| GET | `/api/warehouses/:warehouseId/capacity-snapshot` | ✅ |
| GET | `/api/warehouses/:warehouseId/inbound-requests` | ✅ |
| GET | `/api/zones?warehouseId=...` | ✅ |
| GET | `/api/zones/:zoneId` | ✅ |
| POST/PATCH/DELETE | warehouse, zone | ❌ |

**Put-away** (FE `PutawayBinPicker`) — route **không** gắn `authenticate` ở router, nhưng FE luôn gửi Bearer:

| Method | API | Mục đích |
|--------|-----|----------|
| GET | `/api/racks?zoneId=...` | Chọn kệ |
| GET | `/api/rack-levels?rackId=...` | Chọn tầng |
| GET | `/api/bins?rackLevelId=...` | Chọn bin |
| GET | `/api/storage-reservations?contractId=...` | Lọc bin theo hợp đồng |

#### B. Inbound — vận hành kho

Router: `authenticate` trên toàn bộ `/api/inbound-requests`.  
List/detail: scope `warehouseId` = kho của user (`applyInboundListScope`).

| Method | API | WH_STAFF |
|--------|-----|----------|
| GET | `/api/inbound-requests` | ✅ (auto `warehouseId`) |
| GET | `/api/inbound-requests/:id` | ✅ (`assertInboundReadable`) |
| GET | `/api/inbound-requests/:id/items` | ✅ |
| GET | `/api/inbound-requests/:id/delivery` | ✅ |
| GET | `/api/inbound-requests/:id/approval-readiness` | ✅ |
| PUT | `/api/inbound-requests/:id/delivery` | ✅ (`WAREHOUSE_DISPATCH_ROLES` gồm `WH_STAFF`) — gán tài xế, biển số |
| PATCH | `/api/inbound-requests/:id` | ✅ — duyệt `APPROVED`, `ARRIVED` (TENANT_SELF), `RECEIVING`, `COMPLETED`, hủy… |
| POST | `/api/inbound-requests/:id/start-receiving` | ✅ |
| POST | `/api/inbound-requests/:id/complete-receiving` | ✅ |
| POST | `/api/inbound-requests/:id/bulk-putaway` | ✅ |
| POST | `/api/inbound-requests/:id/auto-putaway` | ✅ |
| POST | `/api/inbound-requests/:id/complete` | ✅ |
| POST | `/api/inbound-requests` | ❌ (tạo inbound: tenant; WH Admin bị `blockWhAdminCreate`) |
| POST | `/api/inbound-requests/:id/report-arrival` | ❌ — **`WH_TRANSPORTER` only** |
| DELETE | `/api/inbound-requests/:id` | Có route; nên hạn chế nghiệp vụ |

**Ghi nhận số lượng từng dòng**

| Method | API |
|--------|-----|
| PATCH | `/api/inbound-requests/:inboundRequestId/items/:itemId` — body `{ receivedQuantity, discrepancyReason? }` |

Route items: `/api/inbound-request-items` (không `authenticate` ở router — FE vẫn gửi token).

**Đánh dấu xe đến (`TENANT_SELF`)**

```http
PATCH /api/inbound-requests/{id}
{ "status": "ARRIVED", "actualArrivalAt": "<ISO8601>" }
```

Điều kiện: inbound `APPROVED`, đã lưu delivery (biển số).  
Nếu `deliveryMode = WAREHOUSE_TRANSPORT` → chuyển `ARRIVED` qua PATCH bị **403**; dùng transporter `report-arrival`.

**Batch / LPN / chi tiết LPN**

| Method | API |
|--------|-----|
| POST | `/api/batches` |
| GET | `/api/batches?inboundRequestId=...` |
| POST | `/api/lpns` |
| GET | `/api/lpns?batchId=...` |
| GET | `/api/lpns/:lpnId/details` |
| GET | `/api/lpns/:lpnId/rack-suggestion` |
| POST | `/api/lpns/:lpnId/putaway` — body `{ binId, movedBy? }` |
| PATCH | `/api/lpns/:lpnId` |
| POST | `/api/lpn-details` |

#### C. Tồn kho

| Method | API | Ghi chú |
|--------|-----|---------|
| GET | `/api/inventories?warehouseId=&tenantId=&...` | ✅ |
| GET | `/api/inventories/:inventoryId` | ✅ |
| GET | `/api/inventories/:inventoryId/movements` | ✅ |

FE `/staff/inventory-ops`: hiện chỉ truyền `warehouseId` khi user là `WH_ADMIN`; `WH_STAFF` nên truyền `warehouseId` từ JWT (list vẫn gọi được nhưng có thể thiếu lọc kho).

#### D. Outbound / shipment (BE có, staff chưa có UI)

Router `authenticate`; chỉ chặn **WH_ADMIN** tạo outbound.

| Method | API | WH_STAFF (BE) |
|--------|-----|----------------|
| GET | `/api/outbound-requests?warehouseId=...` | ✅ (nên lọc theo kho) |
| GET | `/api/outbound-requests/:id` | ✅ |
| PATCH | `/api/outbound-requests/:id` | ✅ — đổi status picking/packing/shipped (Swagger) |
| POST | `/api/outbound-requests` | Không theo matrix nghiệp vụ |
| POST/PATCH | `/api/shipments` | ⏳ chưa tích hợp FE staff |

#### E. Các API **không** dành cho WH_STAFF

| Nhóm | API | Lý do |
|------|-----|--------|
| User management | `/api/users` (CRUD) | 403 |
| Rental | `PATCH /api/rental-requests/:id` duyệt | Chỉ `WH_ADMIN` / `SYSTEM_ADMIN` |
| Contract CRUD | `POST/PATCH/DELETE /api/contracts` | Nghiệp vụ WH Admin |
| Hóa đơn | mark-paid, PayOS | Tenant / WH Admin |
| Thông báo admin | `/api/admin/notifications/*` | Role khác |
| SKU / tenant inbound tạo mới | `POST /api/inbound-requests` | Tenant-side |
| Transporter | `assignedToMe`, `report-arrival` | `WH_TRANSPORTER` |

#### F. Hạn chế đặc biệt trên FE

- Inbound ops: nút **Duyệt / Từ chối** hiện cho mọi `mode=warehouse` (gồm `WH_STAFF`) — BE **không** chặn role khi `PATCH` status (matrix doc ghi duyệt là WH Admin; thực tế staff có thể duyệt nếu gọi API).
- Load danh sách tài xế: `GET /api/users?role=WH_TRANSPORTER` — **403** với `WH_STAFF` (chỉ WH Admin). Gán tài xế trên UI có thể lỗi trừ khi đã biết `userId`.

---

## 3. Tenant Staff (`TENANT_STAFF`)

### 3.1. Nghiệp vụ chính (theo thiết kế)

| # | Chức năng | Trạng thái |
|---|-----------|------------|
| 56 | Tạo inbound request | ✅ |
| 57 | Tạo outbound request | ⏳ (API ✅, FE chưa có route) |
| 58 | Xem trạng thái inbound/outbound | ✅ inbound / ⏳ outbound |
| 59 | Tạo SKU | ⚠️ BE ✅, FE **chỉ xem** (`canEdit = TENANT_ADMIN`) |
| 60 | Sửa SKU | ⚠️ tương tự |
| 61 | Xem tồn kho | ✅ |
| 62 | Xem invoice | ❌ (chưa API billing đầy đủ) |

**So với Tenant Admin** (`TENANT_ADMIN`): staff **không** quản lý account (`/staff/accounts` — `ProtectedRoute` chỉ `TENANT_ADMIN`), **không** xóa SKU (nghiệp vụ), **không** ký hợp đồng / tạo rental (thiết kế — BE một số endpoint chưa chặn role).

**FE routes** (sidebar chung với tenant admin, trừ Accounts)

| Màn hình | Path |
|----------|------|
| Dashboard | `/staff/dashboard` |
| Hợp đồng | `/staff/contracts` — xem; ký nếu UI hiện nút |
| Yêu cầu thuê | `/staff/rental-requests` — form tạo mới có trên FE |
| Sản phẩm / SKU | `/staff/products` — **TENANT_STAFF: xem**, không nút Thêm/Sửa |
| Inbound | `/staff/inbound`, `/staff/inbound/new`, `/staff/inbound/:id` |
| Tồn kho | `/staff/inventory` |

### 3.2. API theo nhóm

#### A. Auth & profile

Giống mục 1.

#### B. Tenant & hợp đồng

| Method | API | TENANT_STAFF |
|--------|-----|--------------|
| GET | `/api/tenants/:tenantId` | ✅ (tenant của mình) |
| GET | `/api/contracts?tenantId=...` | ✅ |
| GET | `/api/contracts/:contractId` | ✅ |
| GET | `/api/contracts/:contractId/invoices` | ✅ (xem) |
| PATCH | `/api/contracts/:contractId` (ký `tenantSignature`) | BE không chặn role — **nên** chỉ Tenant Admin |
| POST | `/api/contracts`, PayOS, mark-paid | ❌ / WH–Admin |

#### C. Rental request

| Method | API | TENANT_STAFF |
|--------|-----|--------------|
| GET | `/api/rental-requests` | ✅ (`authorize` reader) |
| GET | `/api/rental-requests/:id` | ✅ |
| POST | `/api/rental-requests` | ✅ trên BE (`authenticateOptional` + body `tenantId`) — test case kỳ vọng 403 cho staff |
| PATCH | `/api/rental-requests/:id` | ❌ (duyệt/claim: WH Admin) |

#### D. SKU & master data

| Method | API | TENANT_STAFF |
|--------|-----|--------------|
| GET | `/api/skus?tenantId=...` | ✅ |
| GET | `/api/skus/:skuId` | ✅ |
| POST/PATCH | `/api/skus` | ✅ trên BE (không `authorize`) — FE không bật form |
| DELETE | `/api/skus/:id` | ✅ trên BE — **không** dùng theo policy |

Catalog (đọc / master tab):  
`GET /api/categories`, `/api/collections`, `/api/seasons`, `/api/product-kinds`, `/api/size-factors` — FE master tab `canEdit=false` với staff.

#### E. Inbound (tenant)

| Method | API | TENANT_STAFF |
|--------|-----|--------------|
| POST | `/api/inbound-requests` | ✅ |
| GET | `/api/inbound-requests?tenantId=...` | ✅ (scope tenant) |
| GET | `/api/inbound-requests/:id` | ✅ |
| PATCH | `/api/inbound-requests/:id` | ✅ — hủy `DRAFT`/`PENDING`, cập nhật delivery pickup… |
| PUT | `/api/inbound-requests/:id/delivery` | ✅ — `TENANT_SELF` hoặc pickup `WAREHOUSE_TRANSPORT` |
| POST items | `/api/inbound-requests/:id/items` | ✅ khi tạo/chỉnh request |

**Không làm**: receive, batch, LPN, put-away, duyệt inbound (warehouse ops).

#### F. Outbound

| Method | API | TENANT_STAFF |
|--------|-----|--------------|
| POST | `/api/outbound-requests` | ✅ (WH Admin bị chặn tạo) |
| GET | `/api/outbound-requests?tenantId=...` | ✅ |
| GET/PATCH/DELETE | `/api/outbound-requests/:id` | ✅ theo BE |

#### G. Tồn kho

| Method | API |
|--------|-----|
| GET | `/api/inventories?tenantId=<tenant của user>` |
| GET | `/api/inventories/:id`, `.../movements` |

#### H. Warehouse (đọc kho đã có hợp đồng)

| Method | API |
|--------|-----|
| GET | `/api/warehouses`, `/api/warehouses/:id` | ✅ reader + `assertTenantWarehouseAccess` khi cần |

#### I. Không dùng / không có UI

| Nhóm | Ghi chú |
|------|---------|
| `/api/users` (CRUD) | 403 |
| `/api/inbound-requests/*/start-receiving`, putaway, complete-receiving | Warehouse ops |
| `/api/admin/notifications/*` | `TENANT_ADMIN` / WH roles |
| Invoice thanh toán | Chưa hoàn thiện (#62) |
| `/staff/accounts` | FE chặn role |

---

## 4. Ma trận so sánh nhanh

| Tài nguyên | WH_STAFF | TENANT_STAFF |
|------------|----------|--------------|
| Phạm vi | `warehouseId` | `tenantId` |
| Tạo inbound | ❌ | ✅ |
| Duyệt / receive / put-away inbound | ✅ | ❌ |
| Tạo outbound | ⏳ (BE có) | ✅ (API), ⏳ FE |
| SKU CRUD | ❌ (xem qua inbound) | Xem ✅ / Sửa ⚠️ FE |
| Contract ký / rental tạo | ❌ | Xem ✅ / Tạo rental ⚠️ |
| Inventory | Kho (`warehouseId`) | Brand (`tenantId`) |
| Cấu trúc kho (zone/rack/bin) | Đọc + putaway | ❌ |
| Quản lý user | ❌ | ❌ |

Tham chiếu permission tổng quát: `docs/fe-flow-guide.md` — mục **C3. Permission matrix**.

---

## 5. Lưu ý kỹ thuật (BE)

1. **Middleware `authenticate`**: Chỉ một phần route (users, warehouses, zones, inbound/outbound, rental đọc). Nhiều route (`/api/skus`, `/api/lpns`, `/api/batches`, `/api/inventories`, `/api/contracts`, racks/bins…) **không** gắn `authenticate` ở router — phụ thuộc FE gửi token; **không có** kiểm tra role đồng nhất ở tầng route.
2. **Scope inbound**: `src/utils/inboundAccess.js` — tenant/warehouse/transporter.
3. **Delivery dispatch**: `WAREHOUSE_DISPATCH_ROLES` = `SYSTEM_ADMIN`, `WH_ADMIN`, `WH_STAFF`.
4. **AI slot**: `aiSlotRecommendation.routes.js` import nhưng **chưa** `router.use` trong `src/routes/index.js`.
5. **Tài liệu test**: Chi tiết từng bước + payload mẫu — `docs/test1.md` (#48–#62).

---

## 6. Tài liệu liên quan

- `docs/all_role_func.md` — bảng chức năng toàn hệ thống  
- `docs/test1.md` — hướng dẫn test WH Staff / Tenant Staff  
- `docs/fe-flow-guide.md` — luồng FE & permission matrix  
- Swagger: `/api-docs` khi chạy BE  
