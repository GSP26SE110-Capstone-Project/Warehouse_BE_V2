# Changelog

Tất cả thay đổi đáng chú ý của project được ghi nhận trong file này.

Format dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), tuân theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Outbound request items API** — dòng SKU trên phiếu xuất:
  - `GET/POST /api/outbound-requests/:outboundRequestId/items`
  - `GET/POST/PATCH/DELETE /api/outbound-request-items` (+ `?outboundRequestId=`)
  - `POST /api/outbound-requests` nhận `items[]` (SKU + `requestedQuantity`)
  - `GET /api/outbound-requests/:id?includeItems=true`
  - Kiểm tra tồn khi thêm/sửa dòng; khi `PATCH` → `APPROVED` (`INSUFFICIENT_INVENTORY`)
- Tài liệu `README.md` đầy đủ (1185+ dòng) cho team mới onboarding.
- Tài liệu `CONTRIBUTING.md` mô tả quy trình đóng góp.
- Tài liệu `ARCHITECTURE.md` mô tả kiến trúc layered chi tiết.
- Tài liệu `CHANGELOG.md` này.

### Planned

- Test infrastructure (Vitest + Supertest).
- CI/CD pipeline (GitHub Actions).
- Refresh token cho auth.
- Rate limiting middleware.
- Structured logging (Pino).
- Picking task + Shipment API.
- Inventory + Inventory movement API.
- Billing engine (invoice gen).

---

## [0.9.0] — 2026-05-24

### Added — Outbound Request API

- **Outbound Request CRUD** (`/api/outbound-requests`) — mirror pattern Inbound Request:
  - `POST /api/outbound-requests` — tạo outbound (yêu cầu contract `ACTIVE`).
  - `GET /api/outbound-requests` — list với filter `tenantId`, `warehouseId`, `contractId`, `status`, pagination.
  - `GET /api/outbound-requests/:outboundRequestId` — chi tiết.
  - `PATCH /api/outbound-requests/:outboundRequestId` — update status / ship date / approver.
  - `DELETE /api/outbound-requests/:outboundRequestId` — xoá (cascade `outbound_request_items`).
- Constant `OUTBOUND_STATUS` enum: `DRAFT`, `PENDING`, `APPROVED`, `RESERVED`, `PICKING`, `PACKING`, `SHIPPED`, `COMPLETED`, `CANCELLED`.
- Auto-generate `outboundCode` dạng `OUT-<ts>-<rand>` nếu client không gửi.
- OpenAPI schema mới: `OutboundRequest`, `OutboundRequestCreate`, `OutboundRequestUpdate`.
- Tag `OutboundRequest` trong Swagger UI.
- Section `9b. Outbound Request` trong `docs/request.md`.

---

## [0.8.0] — 2026-05-23

### Added — Change Password 2-step (OTP)

- `POST /api/auth/change-password` — verify mật khẩu hiện tại, gửi OTP 6 số tới email.
- `POST /api/auth/change-password/verify` — nhập OTP để xác nhận đổi mật khẩu.
- OTP store in-memory (`src/utils/otpStore.js`):
  - Hash SHA-256 trước khi lưu (không lưu plaintext).
  - TTL 5 phút.
  - Tối đa 5 lần nhập sai → invalidate.
  - Single-use: verify xong → xoá.
- `sendChangePasswordOtp` template trong `src/config/mail.js`.

### Changed

- `src/config/mail.js` — thêm Gmail App Password config.

---

## [0.7.0] — 2026-05-22

### Added — Seed scripts

- `npm run seed:accounts` — tạo `SYSTEM_ADMIN`, `WH_ADMIN`, `TENANT_ADMIN` (idempotent).
- `npm run seed:warehouse` — tạo 3 warehouse + zones/racks/levels/bins đầy đủ:
  - `WH-HCM-01`: 960 bins.
  - `WH-HCM-02`: 192 bins.
  - `WH-HN-01`: 450 bins.

### Changed

- `package.json` — thêm npm scripts cho từng seed riêng biệt.

---

## [0.6.0] — 2026-05-21

### Added — Tenant Onboarding (Flow 1)

#### Storage Reservation CRUD

- `POST /api/storage-reservations`
- `GET /api/storage-reservations` (filter `tenantId`, `contractId`, `warehouseId`, `zoneId`)
- `GET /api/storage-reservations/:storageReservationId`
- `PATCH /api/storage-reservations/:storageReservationId`
- `DELETE /api/storage-reservations/:storageReservationId`

#### Contract + Contract Items CRUD

- `POST /api/contracts`, full CRUD.
- `POST /api/contract-items`, full CRUD.
- Validation: contract phải `ACTIVE` → tenant mới tạo được inbound/outbound.

#### Tenant Company CRUD

- `POST /api/tenants`, full CRUD.

#### Rental Request CRUD

- `POST /api/rental-requests`, full CRUD.
- Status flow: `PENDING` → `APPROVED` / `REJECTED` / `CANCELLED`.

### Documentation

- Section "Tenant Onboarding (Flow 1)" trong `docs/request.md`.
- Workflow example từ rental request → tenant activation.

---

## [0.5.0] — 2026-05-15

### Added — Inbound Request

- `inbound_requests` + `inbound_request_items` tables.
- API `POST/GET/PATCH/DELETE /api/inbound-requests`.
- Filter list theo `tenantId`, `warehouseId`, `contractId`, `status`.
- Validation: contract phải `ACTIVE` + khớp tenant/warehouse.
- Auto-generate `inboundCode` dạng `INB-<ts>-<rand>`.
- Enum `INBOUND_STATUS`: `DRAFT`, `PENDING`, `APPROVED`, `ARRIVED`, `RECEIVING`, `COMPLETED`, `CANCELLED`.

---

## [0.4.0] — 2026-05-10

### Added — Product master + Inventory

- `categories`, `seasons`, `collections`, `skus`, `batches` tables.
- API CRUD đầy đủ cho 5 domain.
- Seed scripts: `seed:product-master`, `seed:collections`.

### Added — LPN

- `lpns`, `lpn_details` tables.
- API CRUD đầy đủ.
- `GET /api/lpns/:lpnId/details` — chi tiết LPN kèm danh sách SKU.
- `GET /api/lpns/:lpnId/rack-suggestion?warehouseId=` — gợi ý rack lưu trữ.

---

## [0.3.0] — 2026-05-05

### Added — Warehouse Structure

- Hierarchical CRUD: `warehouses → zones → racks → rack_levels → bins`.
- Enum `zone_type_enum` (đã bỏ `DEDICATED`).
- Enum `bin_status_enum`: `AVAILABLE`, `OCCUPIED`, `RESERVED`, `BLOCKED`.
- API:
  - `/api/warehouses`
  - `/api/zones`
  - `/api/racks`
  - `/api/rack-levels`
  - `/api/bins`
- Sub-route: `/api/warehouses/:warehouseId/inbound-requests`, `/api/warehouses/:warehouseId/rental-requests`.

---

## [0.2.0] — 2026-04-28

### Added — Authentication

- `POST /api/auth/register` (system admin only).
- `POST /api/auth/login` → JWT trong header.
- `GET /api/auth/me` → thông tin user hiện tại.
- `POST /api/auth/logout` (stateless, client xoá token).
- JWT payload: `{ sub, role, tenantId, warehouseId, email }`.
- Middleware `authenticate`, `authorize(...roles)`.
- bcrypt rounds = 10 cho `password_hash`.

### Added — User Management

- `POST /api/users` (admin only).
- `GET /api/users` (list, filter `role`, `tenantId`, `warehouseId`).
- `GET /api/users/:userId`.
- `PATCH /api/users/:userId`.
- `DELETE /api/users/:userId`.
- Strip `passwordHash` qua `toPublic()` trước khi response.

---

## [0.1.0] — 2026-04-20

### Added — Initial scaffold

- Node.js + Express 5 setup.
- PostgreSQL pool config với retry.
- `BaseModel` / `SchemaModel` / `defineModel` factory.
- Field mapping camelCase ↔ snake_case.
- Centralized error handler.
- Global response format `{ success, data, message, code }`.
- Pagination utility.
- UUID + Enum validators.
- OpenAPI 3.0 setup với Swagger UI.
- Health check endpoint.
- Docker + docker-compose.
- Migration runner cho SQL file.
- DB schema bản 4 (`db4_schema.sql`) với 24 bảng + 10 enum.

---

## Quy ước phiên bản

Project follow **Semantic Versioning** với pattern `MAJOR.MINOR.PATCH`:

- **MAJOR** — breaking change ở API public.
- **MINOR** — thêm tính năng backward-compatible.
- **PATCH** — bug fix, refactor không thay đổi behavior.

### Khi nào bump version?

- Sau khi merge release PR từ `develop` → `main`.
- Trong PR phải kèm bump version trong `package.json` + section mới trong file này.

### Ai chịu trách nhiệm cập nhật?

Người mở release PR. Reviewer kiểm:

- Section `[X.Y.Z]` mới đã có chưa.
- Date ISO 8601 đúng chưa.
- Các thay đổi đã group theo `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security` chưa.

---

## Format reference

Mỗi entry version có cấu trúc:

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added
- New feature A
- New feature B

### Changed
- Behavior X now Y

### Deprecated
- Old endpoint will be removed in vN

### Removed
- Endpoint Z was deleted

### Fixed
- Bug X

### Security
- Patched XSS in Y
```

Không phải mọi version đều có tất cả section — chỉ giữ section có entry.

---

> Maintainers: cập nhật phần `[Unreleased]` mỗi PR đáng kể, rồi convert nó thành version cụ thể khi release.
