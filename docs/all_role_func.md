# All Role Functions — NextGen Warehouse

> **Mục đích**: Bảng tổng hợp chức năng theo role — dùng cho doc Capstone / spreadsheet.
> **Phiên bản**: 1.3 — cập nhật 2026-05-30.
> **Nguồn**: `docs/fe-flow-guide.md`, `docs/warehouse_staff.md`, `docs/tenant_staff.md`, BE `inboundDelivery.service.js`.

---

## Bảng tổng hợp (copy vào spreadsheet)

| # | Function | Role |
|---|----------|------|
| 1 | Create Warehouse | System Admin |
| 2 | Update Warehouse | System Admin |
| 3 | Create Warehouse Admin Account | System Admin |
| 4 | Create Tenant Admin Account | System Admin |
| 5 | Manage Master Data (Category / Season) | System Admin |
| 6 | Approve Rental Request | System Admin |
| 7 | Reject Rental Request | System Admin |
| 8 | View All Tenants | System Admin |
| 9 | View All Contracts | System Admin |
| 10 | View All Invoices | System Admin |
| 11 | View All Reports | System Admin |
| 12 | Create Warehouse Zone | Warehouse Admin |
| 13 | Create Rack | Warehouse Admin |
| 14 | Create Rack Level | Warehouse Admin |
| 15 | Create Bin | Warehouse Admin |
| 16 | Update Warehouse Structure | Warehouse Admin |
| 17 | Create Warehouse Staff Account | Warehouse Admin |
| 18 | Create Transporter Account | Warehouse Admin |
| 19 | Review Rental Request | Warehouse Admin |
| 20 | Approve Rental Request | Warehouse Admin |
| 21 | Reject Rental Request | Warehouse Admin |
| 22 | View Occupancy Dashboard | Warehouse Admin |
| 23 | View Warehouse Inventory | Warehouse Admin |
| 24 | View & Send Invoice | Warehouse Admin |
| 25 | View Warehouse Reports | Warehouse Admin |
| 26 | View Tenant Company Info | Warehouse Admin |
| 27 | View Inbound Request List | Warehouse Admin |
| 28 | View Outbound Request List | Warehouse Admin |
| 29 | Assign Transporter to Inbound Trip | Warehouse Admin |
| 30 | Create Contract | Warehouse Admin |
| 31 | Update Contract | Warehouse Admin |
| 32 | Assign Warehouse / Zone / Bin / Rack / RackLevel | Warehouse Admin |
| 33 | Approve Inbound Request | Warehouse Admin |
| 34 | Reject Inbound Request | Warehouse Admin |
| 35 | Approve Outbound Request | Warehouse Admin |
| 36 | Reject Outbound Request | Warehouse Admin |
| 37 | Create Tenant Staff Account | Tenant Admin |
| 38 | View & Sign Contract | Tenant Admin |
| 39 | Create New Rental Request | Tenant Admin |
| 40 | Create SKU | Tenant Admin |
| 41 | Update SKU | Tenant Admin |
| 42 | Delete SKU | Tenant Admin |
| 43 | Create Inbound Request | Tenant Admin |
| 44 | Create Outbound Request | Tenant Admin |
| 45 | View Inventory | Tenant Admin |
| 46 | View Invoice | Tenant Admin |
| 47 | View Reports | Tenant Admin |
| 48 | Mark Inbound Arrived | Warehouse Staff |
| 49 | Receive Inbound & Record Quantity | Warehouse Staff |
| 50 | Create Batch & LPN | Warehouse Staff |
| 51 | Put-Away LPN to Bin | Warehouse Staff |
| 52 | Execute Outbound Picking | Warehouse Staff |
| 53 | Pack & Create Shipment | Warehouse Staff |
| 54 | Report Damaged Inventory | Warehouse Staff |
| 55 | View Warehouse Inventory | Warehouse Staff |
| 56 | Create Inbound Request | Tenant Staff |
| 57 | Create Outbound Request | Tenant Staff |
| 58 | View Inbound & Outbound Status | Tenant Staff |
| 59 | Create SKU | Tenant Staff |
| 60 | Update SKU | Tenant Staff |
| 61 | View Inventory | Tenant Staff |
| 62 | View Invoice | Tenant Staff |
| 63 | View Assigned Delivery Trips | Warehouse Transporter |
| 64 | View Inbound Trip Detail | Warehouse Transporter |
| 65 | Update Vehicle & Driver Info | Warehouse Transporter |
| 66 | Report Arrival at Warehouse | Warehouse Transporter |
| 67 | Forgot Password | Guest (unauthenticated) |
| 68 | Change Password | All authenticated users |
| 69 | Verify OTP | All authenticated users |
| 70 | Login | All roles (unauthenticated → session) |

---

## System Admin

| # | Function | Role |
|---|----------|------|
| 1 | Create Warehouse | System Admin |
| 2 | Update Warehouse | System Admin |
| 3 | Create Warehouse Admin Account | System Admin |
| 4 | Create Tenant Admin Account | System Admin |
| 5 | Manage Master Data (Category / Season) | System Admin |
| 6 | Approve Rental Request | System Admin |
| 7 | Reject Rental Request | System Admin |
| 8 | View All Tenants | System Admin |
| 9 | View All Contracts | System Admin |
| 10 | View All Invoices | System Admin |
| 11 | View All Reports | System Admin |

---

## Warehouse Admin

| # | Function | Role |
|---|----------|------|
| 12 | Create Warehouse Zone | Warehouse Admin |
| 13 | Create Rack | Warehouse Admin |
| 14 | Create Rack Level | Warehouse Admin |
| 15 | Create Bin | Warehouse Admin |
| 16 | Update Warehouse Structure | Warehouse Admin |
| 17 | Create Warehouse Staff Account | Warehouse Admin |
| 18 | Create Transporter Account | Warehouse Admin |
| 19 | Review Rental Request | Warehouse Admin |
| 20 | Approve Rental Request | Warehouse Admin |
| 21 | Reject Rental Request | Warehouse Admin |
| 22 | View Occupancy Dashboard | Warehouse Admin |
| 23 | View Warehouse Inventory | Warehouse Admin |
| 24 | View & Send Invoice | Warehouse Admin |
| 25 | View Warehouse Reports | Warehouse Admin |
| 26 | View Tenant Company Info | Warehouse Admin |
| 27 | View Inbound Request List | Warehouse Admin |
| 28 | View Outbound Request List | Warehouse Admin |
| 29 | Assign Transporter to Inbound Trip | Warehouse Admin |
| 30 | Create Contract | Warehouse Admin |
| 31 | Update Contract | Warehouse Admin |
| 32 | Assign Warehouse / Zone / Bin / Rack / RackLevel | Warehouse Admin |
| 33 | Approve Inbound Request | Warehouse Admin |
| 34 | Reject Inbound Request | Warehouse Admin |
| 35 | Approve Outbound Request | Warehouse Admin |
| 36 | Reject Outbound Request | Warehouse Admin |

---

## Tenant Admin

| # | Function | Role |
|---|----------|------|
| 37 | Create Tenant Staff Account | Tenant Admin |
| 38 | View & Sign Contract | Tenant Admin |
| 39 | Create New Rental Request | Tenant Admin |
| 40 | Create SKU | Tenant Admin |
| 41 | Update SKU | Tenant Admin |
| 42 | Delete SKU | Tenant Admin |
| 43 | Create Inbound Request | Tenant Admin |
| 44 | Create Outbound Request | Tenant Admin |
| 45 | View Inventory | Tenant Admin |
| 46 | View Invoice | Tenant Admin |
| 47 | View Reports | Tenant Admin |

---

## Warehouse Staff

| # | Function | Role |
|---|----------|------|
| 48 | Mark Inbound Arrived | Warehouse Staff |
| 49 | Receive Inbound & Record Quantity | Warehouse Staff |
| 50 | Create Batch & LPN | Warehouse Staff |
| 51 | Put-Away LPN to Bin | Warehouse Staff |
| 52 | Execute Outbound Picking | Warehouse Staff |
| 53 | Pack & Create Shipment | Warehouse Staff |
| 54 | Report Damaged Inventory | Warehouse Staff |
| 55 | View Warehouse Inventory | Warehouse Staff |

---

## Tenant Staff

| # | Function | Role |
|---|----------|------|
| 56 | Create Inbound Request | Tenant Staff |
| 57 | Create Outbound Request | Tenant Staff |
| 58 | View Inbound & Outbound Status | Tenant Staff |
| 59 | Create SKU | Tenant Staff |
| 60 | Update SKU | Tenant Staff |
| 61 | View Inventory | Tenant Staff |
| 62 | View Invoice | Tenant Staff |

---

## Warehouse Transporter

> **Role code**: `WH_TRANSPORTER` — Tài xế kho.
> **Phạm vi**: 1 warehouse, chỉ các inbound `deliveryMode = WAREHOUSE_TRANSPORT` (kho đi lấy hàng) **đã được gán** cho tài xế.
> **Home route FE**: `/staff/my-deliveries`

| # | Function | Role |
|---|----------|------|
| 63 | View Assigned Delivery Trips | Warehouse Transporter |
| 64 | View Inbound Trip Detail | Warehouse Transporter |
| 65 | Update Vehicle & Driver Info | Warehouse Transporter |
| 66 | Report Arrival at Warehouse | Warehouse Transporter |

### Chi tiết từng chức năng

| Function | Mô tả ngắn | Điều kiện |
|----------|------------|-----------|
| View Assigned Delivery Trips | Xem danh sách chuyến được gán (`assignedToMe=true`) | Chỉ trip gán cho user hiện tại |
| View Inbound Trip Detail | Xem mã inbound, SKU, ngày dự kiến, thông tin delivery | Trip thuộc warehouse + đã assign |
| Update Vehicle & Driver Info | Cập nhật biển số, tên/ SĐT/ CCCD tài xế, hãng vận chuyển, ghi chú | Inbound status = `APPROVED` |
| Report Arrival at Warehouse | Báo xe đã tới cổng kho → inbound `ARRIVED` | Status `APPROVED`, đã có biển số xe |

### Warehouse Transporter — không được làm

- Gán / đổi tài xế khác (WH Admin làm)
- Receive hàng, tạo LPN, put-away (WH Staff làm)
- Duyệt inbound/outbound
- Quản lý cấu trúc kho, SKU, user
- Xóa thông tin delivery

---

## Authentication — Login, Password & OTP (#70, #67–#69)

> **#70**: Guest → authenticated. **#67**: Guest. **#68–#69**: user đã đăng nhập (`ACTIVE`).

| # | Function | Role |
|---|----------|------|
| 70 | Login | All roles (unauthenticated) |
| 67 | Forgot Password | Guest (unauthenticated) |
| 68 | Change Password | All authenticated users |
| 69 | Verify OTP | All authenticated users |

| Function | Mô tả ngắn | API / FE |
|----------|------------|----------|
| Login | Email + mật khẩu → JWT + redirect theo role | FE: `/login` → **Đăng nhập** · API: `POST /api/auth/login` |
| Forgot Password | Nhập email → nhận link đặt lại mật khẩu | FE: `/forgot-password` → `/reset-password?token=...` · API reset: `POST /api/auth/reset-password` |
| Change Password | Bước 1: xác minh mật khẩu cũ, gửi OTP email | `POST /api/auth/change-password` (Bearer token) |
| Verify OTP | Bước 2: nhập OTP 6 số để áp dụng mật khẩu mới | `POST /api/auth/change-password/verify` (Bearer token) |

**Luồng #68 → #69** (đổi mật khẩu khi đã login):

```
POST /change-password { currentPassword, newPassword }
    → OTP gửi email (TTL 10 phút, tối đa 5 lần nhập sai)
POST /change-password/verify { otp }
    → passwordHash cập nhật
```

**Luồng #67** (quên mật khẩu):

```
/forgot-password → nhập email → Gửi yêu cầu
    → (API gửi email — chưa expose) link ?token=...
/reset-password?token=... → Đặt lại mật khẩu
```

**Trạng thái triển khai**: #70 Login FE+BE ✅ · #68–#69 BE ✅ · FE chưa có form OTP (test Swagger). #67 FE form ⏳ · API gửi email forgot ⏳ · reset token từ welcome email ✅.

**Redirect sau login** (`getHomePathForRole`):

| Role | Path |
|------|------|
| `SYSTEM_ADMIN` | `/admin/requests` |
| `WH_ADMIN` | `/admin/dashboard` |
| `TENANT_ADMIN` | `/staff/products` |
| `WH_STAFF`, `TENANT_STAFF` | `/staff/dashboard` |
| `WH_TRANSPORTER` | `/staff/my-deliveries` |

---

## Ghi chú phân quyền

| Role | Phạm vi | Không được làm |
|------|---------|----------------|
| **System Admin** | Toàn hệ thống | — |
| **Warehouse Admin** | 1 warehouse | Tạo SKU, tạo inbound/outbound thay tenant |
| **Warehouse Staff** | 1 warehouse | Duyệt request, quản lý cấu trúc kho, quản lý user |
| **Warehouse Transporter** | 1 warehouse, trip được gán | Nhận hàng trong kho, duyệt request, gán tài xế |
| **Tenant Admin** | 1 tenant (brand) | Thao tác vật lý trong kho, duyệt request |
| **Tenant Staff** | 1 tenant (brand) | Quản lý user, ký hợp đồng, tạo rental request mới, xóa SKU |

### Luồng vận chuyển inbound (WAREHOUSE_TRANSPORT)

```
Tenant tạo inbound (chọn kho đi lấy hàng)
    → WH Admin duyệt + gán tài xế (row 29, 33)
    → Transporter cập nhật thông tin xe (row 65)
    → Transporter báo xe tới kho (row 66) → status ARRIVED
    → WH Staff receive + put-away (row 49–51)
```

**Mark Inbound Arrived (row 48 — WH Staff)** dùng khi tenant tự ship hàng tới kho (`TENANT_SELF`), không qua tài xế kho.

**Tenant Staff vs Tenant Admin**: Tenant Staff làm được hầu hết việc vận hành hàng ngày (SKU, inbound/outbound, xem tồn & invoice) nhưng **không** quản lý account, **không** ký hợp đồng, **không** tạo rental request mới, **không** xóa SKU.
