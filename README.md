# NextGen Warehouse — Backend (Warehouse_BE_V2)

> **SEP490 / SP26SE040 Capstone Project** — Hệ thống quản lý kho thông minh đa-tenant cho ngành thời trang (fashion 3PL), xây dựng trên Node.js + Express + PostgreSQL.

[![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)](https://nodejs.org)
[![Express](https://img.shields.io/badge/express-5.x-blue)](https://expressjs.com)
[![Postgres](https://img.shields.io/badge/postgres-15%2B-336791)](https://www.postgresql.org)
[![OpenAPI](https://img.shields.io/badge/api-OpenAPI%203.0-success)]()
[![License](https://img.shields.io/badge/license-ISC-lightgrey)]()

---

## Mục lục

- [1. Giới thiệu](#1-giới-thiệu)
- [2. Kiến trúc tổng quan](#2-kiến-trúc-tổng-quan)
- [3. Tech stack](#3-tech-stack)
- [4. Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
- [5. Yêu cầu hệ thống](#5-yêu-cầu-hệ-thống)
- [6. Cài đặt nhanh (Quick start)](#6-cài-đặt-nhanh-quick-start)
- [7. Cấu hình môi trường (.env)](#7-cấu-hình-môi-trường-env)
- [8. Cơ sở dữ liệu](#8-cơ-sở-dữ-liệu)
- [9. Seed data](#9-seed-data)
- [10. Chạy server](#10-chạy-server)
- [11. Authentication & Authorization](#11-authentication--authorization)
- [12. API Endpoints](#12-api-endpoints)
- [13. Convention & coding style](#13-convention--coding-style)
- [14. Error handling](#14-error-handling)
- [15. Phân trang](#15-phân-trang)
- [16. Validation](#16-validation)
- [17. OpenAPI / Swagger](#17-openapi--swagger)
- [18. Email & OTP](#18-email--otp)
- [19. Các flow nghiệp vụ](#19-các-flow-nghiệp-vụ)
- [20. Docker & deployment](#20-docker--deployment)
- [21. Troubleshooting](#21-troubleshooting)
- [22. Quy trình đóng góp (Contributing)](#22-quy-trình-đóng-góp-contributing)
- [23. Roadmap](#23-roadmap)
- [24. Glossary — Thuật ngữ nghiệp vụ](#24-glossary--thuật-ngữ-nghiệp-vụ)
- [25. License](#25-license)

---

## 1. Giới thiệu

**NextGen Warehouse** là nền tảng quản lý kho thông minh (Smart Warehouse Management System — WMS) được thiết kế cho các nhà cung cấp dịch vụ kho 3PL (Third-Party Logistics) chuyên ngành thời trang. Hệ thống cho phép nhiều **tenant** (brand thời trang) cùng thuê chỗ trong cùng một hoặc nhiều warehouse vật lý, theo dõi tồn kho theo SKU / Batch / LPN, và tự động hoá luồng nhập — xuất — kiểm kê — billing.

### Mục tiêu sản phẩm

- **Multi-tenant** đúng nghĩa: dữ liệu cô lập giữa các brand nhưng dùng chung hạ tầng warehouse.
- **Hierarchical storage**: `warehouse → zone → rack → rack_level → bin` đến cấp ô lưu nhỏ nhất.
- **Inventory traceability**: mỗi đơn vị tồn kho được gắn LPN (License Plate Number) để truy nguyên nguồn gốc, batch, hạn dùng nếu có.
- **Lifecycle hoàn chỉnh**: từ rental request → contract → inbound → put-away → tồn kho → outbound → picking → packing → shipment → billing.
- **Auditable**: mọi inventory movement đều được ghi nhật ký.
- **API-first**: tất cả nghiệp vụ expose qua REST API có OpenAPI/Swagger.

### Đối tượng người dùng (roles)

| Role | Mô tả |
|------|-------|
| `SYSTEM_ADMIN` | Quản trị toàn hệ thống, tạo warehouse và admin warehouse |
| `WH_ADMIN` | Quản trị 1 warehouse: duyệt rental request, cấp contract, vận hành nhập/xuất |
| `WH_STAFF` | Nhân viên warehouse: receive, put-away, pick, pack, ship |
| `TENANT_ADMIN` | Admin brand: gửi rental request, quản lý SKU/collection, tạo inbound/outbound |
| `TENANT_STAFF` | Nhân viên brand: tạo & theo dõi inbound/outbound, xem tồn kho |

---

## 2. Kiến trúc tổng quan

Hệ thống được tổ chức theo mô hình **layered architecture** quen thuộc trong Node.js / Express:

```
┌──────────────────────────────────────────────────────┐
│            Client (Web FE / Mobile FE)               │
└──────────────────────────────────────────────────────┘
                       │ HTTP / JSON
                       ▼
┌──────────────────────────────────────────────────────┐
│   Express Router  →  Middleware (auth / asyncHandler)│
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│   Controllers (request/response only, không có logic) │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│   Services (business logic, validation, orchestration)│
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│   Models  (BaseModel / SchemaModel — wrapper trên pg) │
└──────────────────────────────────────────────────────┘
                       │ SQL (parameterised)
                       ▼
┌──────────────────────────────────────────────────────┐
│              PostgreSQL (smart_warehouse)            │
└──────────────────────────────────────────────────────┘
```

### Nguyên tắc thiết kế

- **Controller mỏng**: chỉ parse `req`, gọi service, format response. Tuyệt đối không truy vấn DB trực tiếp trong controller.
- **Service dày**: chứa toàn bộ business rules (ví dụ: contract phải `ACTIVE` mới được tạo inbound).
- **Model thuần CRUD**: `findById`, `findAll`, `create`, `updateById`, `deleteById`, `count`. Không bao giờ chứa nghiệp vụ.
- **camelCase ↔ snake_case**: trong code JS dùng camelCase (`tenantId`); trong DB dùng snake_case (`tenant_id`). Việc map do `fieldMapper` xử lý tự động.
- **Single source of truth cho schema**: file `scripts/sql/db4_schema.sql`. Mọi thay đổi DDL phải đi qua migration script.
- **Idempotent seed**: mọi script seed có thể chạy lại nhiều lần mà không sinh dữ liệu trùng.

---

## 3. Tech stack

| Layer | Công nghệ | Version | Lý do chọn |
|-------|-----------|---------|------------|
| Runtime | Node.js | ≥ 18 | LTS, support top-level await, native fetch |
| Web framework | Express | 5.x | Phổ biến, ecosystem rộng |
| Database | PostgreSQL | 15+ | ACID, hỗ trợ UUID, ENUM, JSONB |
| DB driver | `pg` (node-postgres) | ^8.16 | Pool connection, parameterised query |
| Auth | `jsonwebtoken` + `bcrypt` | ^9, ^5 | JWT stateless + hash mật khẩu |
| Mail | `nodemailer` | ^6.9 | Gmail / SMTP cho OTP, notification |
| API docs | `swagger-ui-express` + `swagger-jsdoc` | ^5, ^6 | OpenAPI 3.0 |
| CORS | `cors` | ^2.8 | Whitelist FE origins |
| Body parser | `body-parser` | ^2.2 | JSON parser |
| Env loader | `dotenv` | ^17 | Đọc `.env` |
| HTTP client | `axios` | ^1.13 | Gọi external service (Cloudinary,…) |
| Dev | `nodemon` | ^3.1 | Hot reload |
| Image | Cloudinary | (REST) | CDN ảnh sản phẩm / SKU |

> **Không dùng ORM** (Sequelize/Prisma/TypeORM) — team chủ đích viết wrapper nhỏ để team thực hiện được dễ học, đồng thời kiểm soát SQL chặt chẽ hơn cho phần tối ưu sau.

---

## 4. Cấu trúc thư mục

```
Warehouse_BE_V2/
├── docker-compose.yml              # Stack postgres + app cho dev/prod
├── Dockerfile                      # Build image Node.js
├── package.json                    # Scripts + dependencies
├── server.js                       # Entrypoint (bootstrap Express, DB pool)
├── .env                            # Local env (không commit)
├── .env.example                    # Mẫu env share cho team
│
├── docs/
│   ├── db4.md                      # Mô tả DB schema bản 4
│   ├── flow.md                     # Mô tả các flow nghiệp vụ
│   └── request.md                  # Ví dụ request/response cho FE
│
├── scripts/
│   ├── run-migration.mjs           # Apply SQL file
│   ├── seed-accounts.mjs           # Seed admin + tenant admin
│   ├── seed-warehouse.mjs          # Seed zones/racks/levels/bins
│   ├── seed-product-master.mjs     # Seed category + season master
│   ├── seed-collections.mjs        # Seed collection cho tenant
│   ├── seed-system-admin.mjs       # Seed account SYSTEM_ADMIN
│   ├── list-db-tables.mjs          # In ra tất cả table
│   ├── generate-schema-models.mjs  # Auto-gen model JS từ DB schema
│   └── sql/
│       ├── db4_schema.sql          # DDL chính (single source of truth)
│       ├── db4_drop_legacy.sql     # Drop bảng cũ trước reset
│       └── *.sql                   # Migration files khác
│
├── init-scripts/                   # Init scripts cho container postgres
│
└── src/
    ├── app.js                      # Khởi tạo Express app, mount middleware
    ├── config/
    │   ├── db.js                   # PG pool + testConnection retry
    │   ├── jwt.js                  # Sign/verify JWT
    │   ├── mail.js                 # Nodemailer transporter + templates
    │   └── swagger.js              # Mount Swagger UI
    │
    ├── constants/
    │   ├── auth.js                 # USER_ROLES, USER_STATUS
    │   ├── inbound.js              # INBOUND_STATUS enum
    │   ├── outbound.js             # OUTBOUND_STATUS enum
    │   ├── tenantOnboarding.js     # Rental request / contract enums
    │   └── warehouseStructure.js   # Zone/rack types, bin statuses
    │
    ├── controllers/                # 1 file / domain — controller mỏng
    │   ├── auth.controller.js
    │   ├── warehouse.controller.js
    │   ├── ... (21 files)
    │
    ├── docs/
    │   └── openapi.js              # Toàn bộ OpenAPI spec (tags/paths/schemas)
    │
    ├── middleware/
    │   ├── asyncHandler.js         # Wrap async để catch error tự động
    │   ├── authenticate.js         # Verify JWT, attach req.user
    │   ├── authorize.js            # Role-based access control
    │   ├── errorHandler.js         # Global error → JSON response
    │   └── notFound.js             # 404 fallback
    │
    ├── models/                     # 22 model files — wrapper trên pg
    │   ├── BaseModel.js            # CRUD generic
    │   ├── SchemaModel.js          # Mở rộng BaseModel, dùng schema
    │   ├── defineModel.js          # Factory: schema → model instance
    │   ├── index.js                # Re-export tất cả model
    │   ├── utils/
    │   │   └── fieldMapper.js      # camel ↔ snake mapping
    │   └── (RentalRequest|Contract|Inbound|...).js
    │
    ├── routes/                     # 1 file / domain
    │   ├── index.js                # Mount tất cả sub-router vào /api
    │   ├── auth.routes.js
    │   └── ... (20+ files)
    │
    ├── services/                   # Business logic
    │   ├── auth.service.js         # Login, register, change-password
    │   ├── inboundRequest.service.js
    │   ├── outboundRequest.service.js
    │   ├── lpnRackSuggestion.service.js   # Gợi ý rack đặt LPN
    │   └── ... (22+ files)
    │
    └── utils/
        ├── apiResponse.js          # success / created / paginated / fail
        ├── AppError.js             # Custom Error class với statusCode + code
        ├── otpStore.js             # In-memory OTP store (TTL + attempts)
        ├── password.js             # bcrypt wrapper
        ├── userPublic.js           # Strip mật khẩu trước khi trả về
        └── validate.js             # parseUuid, parsePagination, assertEnum
```

---

## 5. Yêu cầu hệ thống

| Thành phần | Min | Khuyến nghị |
|------------|-----|-------------|
| Node.js | 18.18 | 20 LTS |
| npm | 9 | 10+ |
| PostgreSQL | 14 | 16 |
| RAM (dev) | 4 GB | 8 GB |
| Disk | 1 GB | 5 GB |
| OS | Win 10 / macOS 12 / Ubuntu 20.04 | — |

### Tài khoản bên ngoài (optional cho dev)

- Gmail account + **App Password** để gửi OTP (nếu bỏ qua thì chức năng đổi mật khẩu chỉ chạy được tới bước verify mật khẩu hiện tại).
- Cloudinary account (free tier OK) để upload ảnh SKU.

---

## 6. Cài đặt nhanh (Quick start)

### Cách 1 — chạy local thuần (không Docker)

```bash
# 1. Clone repo
git clone https://github.com/GSP26SE110-Capstone-Project/Warehouse_BE_V2.git
cd Warehouse_BE_V2

# 2. Cài deps
npm install

# 3. Tạo file env từ mẫu
cp .env.example .env   # (Windows PowerShell: copy .env.example .env)
# Sửa POSTGRES_* và EMAIL_* trong .env

# 4. Tạo DB + apply schema
createdb smart_warehouse
npm run db:migrate

# 5. Seed dữ liệu mẫu
npm run seed:accounts
npm run seed:warehouse
npm run seed:product-master
npm run seed:collections

# 6. Chạy dev server
npm run dev
```

Mở `http://localhost:3000/api-docs/` để xem Swagger UI.

### Cách 2 — chạy bằng Docker Compose

```bash
docker compose up -d
docker compose logs -f app
```

Compose sẽ tự build image app, mở Postgres, apply schema (qua `init-scripts/`), start server.

---

## 7. Cấu hình môi trường (.env)

Tất cả biến môi trường được nạp từ file `.env` ở root project. **Đừng commit `.env` thật**, hãy commit `.env.example`.

```dotenv
# --- App ---
NODE_ENV=development           # development | production
PORT=3000

# --- PostgreSQL ---
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=warehouse_admin
POSTGRES_PASSWORD=YourStrongPassword!
POSTGRES_DB=smart_warehouse
# Hoặc dùng connection URL (override các biến trên):
# DATABASE_URL=postgresql://user:pass@host:5432/dbname

# --- JWT ---
JWT_SECRET=ChooseAVeryLongRandomStringForProduction
JWT_EXPIRES_IN=7d              # ví dụ 1h, 7d, 30d

# --- Email (cho OTP đổi mật khẩu) ---
EMAIL_SERVICE=gmail            # gmail | smtp
EMAIL_USER=your.account@gmail.com
EMAIL_APP_PASSWORD=xxxx yyyy zzzz wwww   # Gmail App Password (4 nhóm)

# Hoặc custom SMTP:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false

# --- Cloudinary (upload ảnh SKU) ---
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

### Lấy Gmail App Password thế nào?

1. Bật 2-Step Verification cho Google account.
2. Vào https://myaccount.google.com/apppasswords.
3. Tạo App Password cho "Mail" / "Other (Custom name)".
4. Copy 16 ký tự (4 nhóm × 4) vào `EMAIL_APP_PASSWORD` — giữ dấu cách hoặc bỏ đều được, code sẽ trim.

---

## 8. Cơ sở dữ liệu

### Diagram cấp cao

```
tenant_companies ───┐
                    ├── rental_requests
                    ├── contracts ─── contract_items
                    ├── inbound_requests ─── inbound_request_items
                    ├── outbound_requests ─── outbound_request_items
                    ├── lpns ─── lpn_details
                    ├── skus ─── batches
                    └── collections ─── seasons

warehouses ──┬── warehouse_zones ─── racks ─── rack_levels ─── bins
             ├── storage_reservations
             ├── inventories
             ├── inventory_movements
             ├── picking_tasks ─── picking_task_items
             ├── shipments
             ├── occupancy_snapshots
             └── storage_usage_snapshots

invoices ─── invoice_items ─── payments
pricing_policies
ai_slot_recommendations
sku_movement_analytics
```

### Bảng chính (24 tables)

| Nhóm | Bảng | Mô tả ngắn |
|------|------|------------|
| Auth | `users` | Tài khoản, role, status, password_hash |
| Tenant | `tenant_companies` | Brand thuê kho |
| Tenant | `rental_requests` | Đơn xin thuê kho (pending → approved/rejected) |
| Tenant | `contracts` | Hợp đồng thuê (active/expired/cancelled) |
| Tenant | `contract_items` | Chi tiết slot/zone được thuê trong contract |
| Warehouse | `warehouses` | Kho vật lý |
| Warehouse | `warehouse_zones` | Vùng trong kho (ambient/cold/quarantine/…) |
| Warehouse | `racks` | Kệ |
| Warehouse | `rack_levels` | Tầng trong kệ |
| Warehouse | `bins` | Ô lưu nhỏ nhất |
| Product | `categories` | Danh mục SP (Áo, Quần,…) |
| Product | `seasons` | Mùa (SS, FW,…) |
| Product | `collections` | Bộ sưu tập của brand |
| Product | `skus` | Mã đơn vị lưu kho |
| Product | `batches` | Lô hàng nhập (gắn inbound_request) |
| Inbound | `inbound_requests` | Đơn nhập kho |
| Inbound | `inbound_request_items` | Chi tiết SKU + qty mong đợi |
| Storage | `lpns` | LPN (carton/pallet) — chứa nhiều SKU |
| Storage | `lpn_details` | Chi tiết SKU + qty trong LPN |
| Storage | `inventories` | Tồn kho theo bin/SKU/LPN |
| Storage | `inventory_movements` | Audit log mọi movement |
| Storage | `storage_reservations` | Slot dành riêng cho tenant |
| Outbound | `outbound_requests` | Đơn xuất kho |
| Outbound | `outbound_request_items` | Chi tiết SKU + qty yêu cầu |
| Outbound | `picking_tasks` | Task pick gắn outbound |
| Outbound | `picking_task_items` | Chi tiết pick từng LPN |
| Outbound | `shipments` | Giao hàng + tracking |
| Billing | `invoices`, `invoice_items`, `payments` | Hoá đơn & thanh toán |
| Billing | `pricing_policies` | Chính sách giá theo zone/season |
| Analytics | `occupancy_snapshots`, `storage_usage_snapshots`, `sku_movement_analytics` | Snapshot phục vụ báo cáo |
| AI | `ai_slot_recommendations` | Gợi ý slot lưu từ ML service |

### Enum types

PostgreSQL ENUM được khai báo trong `db4_schema.sql`:

| ENUM | Giá trị |
|------|---------|
| `user_role_enum` | `SYSTEM_ADMIN`, `WH_ADMIN`, `WH_STAFF`, `TENANT_ADMIN`, `TENANT_STAFF` |
| `rental_request_status_enum` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `contract_status_enum` | `DRAFT`, `ACTIVE`, `EXPIRED`, `TERMINATED` |
| `inbound_status_enum` | `DRAFT`, `PENDING`, `APPROVED`, `ARRIVED`, `RECEIVING`, `COMPLETED`, `CANCELLED` |
| `outbound_status_enum` | `DRAFT`, `PENDING`, `APPROVED`, `RESERVED`, `PICKING`, `PACKING`, `SHIPPED`, `COMPLETED`, `CANCELLED` |
| `picking_task_status_enum` | `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `shipment_status_enum` | `READY`, `IN_TRANSIT`, `DELIVERED`, `RETURNED` |
| `lpn_status_enum` | `EMPTY`, `RECEIVING`, `STORED`, `PICKING`, `SHIPPED`, `EMPTY_RETURNED` |
| `bin_status_enum` | `AVAILABLE`, `OCCUPIED`, `RESERVED`, `BLOCKED` |
| `zone_type_enum` | `AMBIENT`, `COLD`, `QUARANTINE`, `RETURN` (đã bỏ `DEDICATED`) |

### Migration scripts

```bash
# Apply schema lần đầu (idempotent: dùng CREATE TABLE IF NOT EXISTS)
npm run db:migrate

# Reset DB hoàn toàn (drop legacy + re-create)
npm run db:reset

# Migration patch nhỏ
npm run db:migrate:zone-type
npm run db:migrate:rental-requests
npm run db:migrate:lpn-weight

# Xem list table hiện có
npm run db:tables
```

---

## 9. Seed data

Tất cả seed script là **idempotent** — chạy nhiều lần không nhân đôi dữ liệu.

### `seed:accounts`

Tạo 3 tài khoản mẫu để FE test:

| Email | Role | Mật khẩu | Ghi chú |
|-------|------|----------|---------|
| `system.admin@warehouse.local` | `SYSTEM_ADMIN` | `Admin@12345` | Global admin |
| `wh.admin@warehouse.local` | `WH_ADMIN` | `Admin@12345` | Gắn `WH-HCM-01` |
| `tenant.admin@brand-a.com` | `TENANT_ADMIN` | `Admin@12345` | Gắn tenant `BRAND-A` |

Lệnh: `npm run seed:accounts`.

### `seed:warehouse`

Tạo 3 warehouse với đầy đủ cấu trúc:

- `WH-HCM-01` (HCM, primary) — 4 zones × 6 racks × 5 levels × 8 bins = **960 bins**.
- `WH-HCM-02` (HCM, satellite) — 2 zones × 4 racks × 4 levels × 6 bins = **192 bins**.
- `WH-HN-01` (Hà Nội) — 3 zones × 5 racks × 5 levels × 6 bins = **450 bins**.

Lệnh: `npm run seed:warehouse`.

### `seed:product-master`

Tạo master data dùng chung cho mọi tenant:

- `categories`: Áo, Quần, Phụ kiện.
- `seasons`: SS26, FW26, SS27, FW27.

Lệnh: `npm run seed:product-master`.

### `seed:collections`

Tạo 4 collection thuộc tenant đầu tiên (hoặc tenant cụ thể qua biến `SEED_TENANT_ID=uuid`).

Lệnh: `npm run seed:collections`.

### Pipeline đề xuất khi reset môi trường

```bash
npm run db:reset
npm run seed:accounts
npm run seed:warehouse
npm run seed:product-master
npm run seed:collections
```

---

## 10. Chạy server

```bash
# Dev (hot reload qua nodemon)
npm run dev

# Production
npm start
```

Log khởi động bình thường:

```
Server is running on port 3000
Environment: development
Swagger Docs: http://localhost:3000/api-docs (49 paths)
OpenAPI JSON: http://localhost:3000/api-docs.json
API base: http://localhost:3000/api
Database connected successfully: { now: 2026-05-24T... }
```

### Health check

```bash
curl http://localhost:3000/api/health
# → { "success": true, "data": { "status": "ok", "database": "connected" } }
```

---

## 11. Authentication & Authorization

### Flow đăng nhập

1. Client `POST /api/auth/login` với `{ email, password }`.
2. Server bcrypt-compare hash, tạo JWT `{ sub, role, tenantId, warehouseId, email }`.
3. Trả `{ token, user }`. Client lưu vào memory / cookie HttpOnly.
4. Các request sau gắn header `Authorization: Bearer <token>`.

### Middleware `authenticate`

Decode JWT → attach `req.user`. Throw 401 nếu thiếu/invalid/expired.

### Middleware `authorize(...roles)`

```js
router.delete('/warehouses/:id',
  authenticate,
  authorize('SYSTEM_ADMIN'),
  asyncHandler(warehouseController.remove));
```

### Đổi mật khẩu 2 bước (OTP)

1. `POST /api/auth/change-password` — body `{ currentPassword, newPassword }`. Server verify password hiện tại, sinh OTP 6 số (TTL 5 phút), email tới user.
2. `POST /api/auth/change-password/verify` — body `{ otp }`. Server kiểm OTP, đổi mật khẩu nếu khớp.

OTP được lưu **in-memory** (`Map`) với:

- Hash trước khi lưu (SHA-256).
- TTL 5 phút.
- Tối đa 5 lần nhập sai → invalidate.
- Single-use: verify xong là xoá.

---

## 12. API Endpoints

> Mở Swagger UI để có form test trực tiếp: `http://localhost:3000/api-docs/`.

### Tổng quan

| Tag | Prefix | Số endpoint |
|-----|--------|-------------|
| Auth | `/api/auth` | 5 |
| User | `/api/users` | 5 |
| Warehouse | `/api/warehouses` | 5 + sub-routes |
| Zone | `/api/zones` | 5 |
| Rack | `/api/racks` | 5 |
| RackLevel | `/api/rack-levels` | 5 |
| Bin | `/api/bins` | 5 |
| RentalRequest | `/api/rental-requests` | 5 |
| TenantCompany | `/api/tenants` | 5 |
| Contract | `/api/contracts` | 5 |
| ContractItem | `/api/contract-items` | 5 |
| StorageReservation | `/api/storage-reservations` | 5 |
| Category | `/api/categories` | 5 |
| Season | `/api/seasons` | 5 |
| Collection | `/api/collections` | 5 |
| SKU | `/api/skus` | 5 |
| Batch | `/api/batches` | 5 |
| LPN | `/api/lpns` | 5 + suggestion |
| LPN Detail | `/api/lpn-details` | 5 |
| **InboundRequest** | `/api/inbound-requests` | 5 |
| **OutboundRequest** | `/api/outbound-requests` | 5 |
| Health | `/api/health` | 1 |

### Convention REST chung

| HTTP | Path | Mục đích |
|------|------|----------|
| `GET` | `/resource` | List (kèm filter + page/limit) |
| `GET` | `/resource/:id` | Detail |
| `POST` | `/resource` | Create |
| `PATCH` | `/resource/:id` | Partial update |
| `DELETE` | `/resource/:id` | Delete (soft hoặc hard tuỳ domain) |

Parent-child: `parentId` truyền trong **body** khi POST, trong **query** khi GET list.

### Ví dụ Outbound Request (flow xuất kho)

```http
POST /api/outbound-requests
Content-Type: application/json
Authorization: Bearer <token>

{
  "tenantId": "uuid-tenant",
  "contractId": "uuid-contract-active",
  "warehouseId": "uuid-warehouse",
  "requestedShipDate": "2026-05-28T10:00:00.000Z",
  "status": "PENDING"
}
```

Response 201:

```json
{
  "success": true,
  "message": "Outbound request created",
  "data": {
    "outboundRequestId": "uuid",
    "outboundCode": "OUT-LX1A2B-0C",
    "status": "PENDING",
    "createdAt": "2026-05-24T10:00:00.000Z"
  }
}
```

Cập nhật status:

```http
PATCH /api/outbound-requests/{outboundRequestId}
{
  "status": "SHIPPED",
  "actualShippedAt": "2026-05-28T14:30:00.000Z"
}
```

> Xem thêm 1300+ dòng ví dụ chi tiết trong `docs/request.md`.

---

## 13. Convention & coding style

### File / folder naming

- File: `camelCase.js` (`inboundRequest.service.js`).
- Class / Model export: `PascalCase` (`InboundRequest`).
- Constants: `SCREAMING_SNAKE_CASE` (`INBOUND_STATUS`).

### Tổ chức 1 domain

Mỗi domain nghiệp vụ có **4 file song song**:

```
src/models/<Domain>.js
src/services/<domain>.service.js
src/controllers/<domain>.controller.js
src/routes/<domain>.routes.js
```

Cộng với:

- `src/constants/<domain>.js` nếu có enum riêng.
- 1 hoặc nhiều schema trong `src/docs/openapi.js`.

### Imports

- Dùng ESM (`import/export`), không CommonJS.
- Thứ tự: external → internal config → internal models → services → utils → constants.

### Async

- Bắt buộc dùng `asyncHandler` wrap controller để propagate error.
- Không `try/catch` lặp đi lặp lại trong controller.

### Validate input

- Service tự validate (UUID, enum, required) — **không trust controller**.
- Throw `AppError(message, statusCode, code)`.

### Response

- Thành công: dùng `success(res, data)`, `created(res, data, msg)`, `paginated(res, items, meta)`.
- Thất bại: throw `AppError`, errorHandler sẽ tự format.

---

## 14. Error handling

`AppError` extends `Error`:

```js
new AppError('Inbound request not found', 404, 'NOT_FOUND');
new AppError('contractId is required', 400, 'VALIDATION_ERROR');
new AppError('Email already in use', 409, 'DUPLICATE');
```

`errorHandler` middleware bắt:

1. `AppError` → trả status + code đúng như khai báo.
2. Postgres error (`code` field) → map sang `AppError`:
   - `23505` (unique violation) → 409 `DUPLICATE`.
   - `23503` (foreign key violation) → 400 `FK_VIOLATION`.
   - `23502` (not null) → 400 `MISSING_FIELD`.
   - `22P02` (invalid input syntax) → 400 `INVALID_INPUT`.
3. JWT error → 401 `INVALID_TOKEN` / `TOKEN_EXPIRED`.
4. Còn lại → 500 `INTERNAL_ERROR`.

Response body chuẩn:

```json
{
  "success": false,
  "message": "Inbound request not found",
  "code": "NOT_FOUND"
}
```

Trong môi trường `NODE_ENV=development`, response còn có thêm field `stack` để debug.

---

## 15. Phân trang

Utility `parsePagination(req.query)` trong `src/utils/validate.js`:

- `page` (default 1, min 1).
- `limit` (default 20, min 1, max 100).
- Tính `offset = (page - 1) * limit`.

Controller chỉ cần:

```js
const { page, limit, offset } = parsePagination(req.query);
const result = await service.list({ ...filters, page, limit, offset });
paginated(res, result.items, result.meta);
```

Response chuẩn:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 }
}
```

---

## 16. Validation

### `parseUuid(value, fieldName)`

```js
data.tenantId = parseUuid(data.tenantId, 'tenantId');
```

Throw 400 nếu không phải UUID hợp lệ. Trả về string UUID đã lowercase.

### `assertEnum(value, allowedList, fieldName)`

```js
assertEnum(data.status, INBOUND_STATUS, 'status');
```

Bỏ qua nếu `value == null` (cho phép optional). Throw 400 nếu giá trị không thuộc allowed list.

### `pickFields(source, allowedFields)`

Loại bỏ các field "lậu" (security):

```js
const data = pickFields(req.body, ['name', 'email', 'role']);
// req.body.passwordHash sẽ bị bỏ qua
```

---

## 17. OpenAPI / Swagger

Toàn bộ spec gom trong **1 file duy nhất**: `src/docs/openapi.js`. File này là Plain JS object — không phụ thuộc JSDoc parser — nên hot-reload nhanh và dễ refactor.

### Cấu trúc file

```js
export default {
  openapi: '3.0.0',
  info: { ... },
  servers: [{ url: 'http://localhost:3000' }],
  tags: [ ... ],          // Group endpoint theo domain
  components: {
    schemas: { ... },     // Schemas dùng chung
    parameters: { ... },  // page, limit
    securitySchemes: { bearerAuth: { ... } },
  },
  paths: {
    '/api/auth/login': { post: { ... } },
    ...
  },
};
```

### Mount vào Express

`src/config/swagger.js`:

```js
import swaggerUi from 'swagger-ui-express';
import openapiSpec from '../docs/openapi.js';

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.get('/api-docs.json', (_, res) => res.json(openapiSpec));
```

### Khi thêm endpoint mới — checklist

- [ ] Thêm path trong `openapi.js`.
- [ ] Khai báo schema mới trong `components.schemas` (nếu cần).
- [ ] Update tag mô tả nếu là domain mới.
- [ ] Test trên Swagger UI (Ctrl + F5 để bỏ cache).

---

## 18. Email & OTP

### `sendChangePasswordOtp({ to, fullName, otp, ttlMinutes })`

Template HTML đơn giản, tiếng Việt:

```
Xin chào <fullName>,

Mã OTP đổi mật khẩu của bạn là: <strong style="font-size:24px">123456</strong>

Mã có hiệu lực trong <ttlMinutes> phút. Vui lòng không chia sẻ mã này với bất kỳ ai.

Nếu bạn không yêu cầu, hãy bỏ qua email này hoặc liên hệ admin để được hỗ trợ.
```

### `otpStore` API

```js
import { generateOtp, saveOtp, verifyOtp, clearOtp } from '../utils/otpStore.js';

const otp = generateOtp();          // '482931'
saveOtp(userId, {
  otp,
  ttlMs: 5 * 60 * 1000,
  payload: { newPasswordHash }
});

// Khi user submit OTP:
const payload = verifyOtp(userId, otpFromUser);
// → { newPasswordHash } nếu đúng; throw nếu sai
```

Đặc tính:

- **Hashed**: lưu SHA-256(otp), không lưu plaintext.
- **TTL**: tự xoá sau hết hạn (mỗi lần `verifyOtp` cũng check expiry).
- **Attempts**: tối đa 5 lần sai → record bị xoá → user phải request OTP mới.
- **Single use**: verify thành công là xoá ngay.

> Production nên thay `Map` bằng **Redis** để hỗ trợ multi-instance + auto-expire.

---

## 19. Các flow nghiệp vụ

### Flow 1 — Tenant Onboarding

```
1. Tenant gửi rental_request (PENDING)
2. WH_ADMIN duyệt → APPROVED
3. WH_ADMIN tạo tenant_companies (nếu chưa có)
4. WH_ADMIN tạo contract + contract_items
5. WH_ADMIN tạo storage_reservations cho từng zone/rack
6. Contract chuyển ACTIVE → tenant có thể tạo inbound
```

Chi tiết: xem `docs/flow.md` và `docs/request.md` section 9.

### Flow 2 — Inbound (nhập hàng)

```
1. Tenant tạo inbound_request (status PENDING, contract phải ACTIVE)
2. Tenant thêm inbound_request_items (SKU + expected qty)
3. WH_ADMIN duyệt → APPROVED
4. Hàng đến → status ARRIVED
5. WH_STAFF receive, gắn LPN → status RECEIVING
6. WH_STAFF put-away vào bin → status COMPLETED
7. inventory + inventory_movement được ghi nhận
```

### Flow 3 — Storage (lưu kho)

- Mỗi LPN có `currentBinId` — luôn track vị trí hiện tại.
- `inventories` snapshot tồn kho theo `(bin_id, sku_id, lpn_id, qty)`.
- `inventory_movements` ghi mọi hành động (RECEIVE / PUTAWAY / MOVE / PICK / ADJUST).
- `lpn_rack_suggestion` service đề xuất rack đặt LPN dựa trên zone matching + capacity.

### Flow 4 — Outbound (xuất hàng)

```
1. Tenant tạo outbound_request (status PENDING)
2. Tenant thêm outbound_request_items (SKU + requested qty)
3. WH_ADMIN duyệt → APPROVED
4. System reserve inventory → status RESERVED
5. WH_STAFF nhận picking_task → status PICKING
6. Pick từ bin → cập nhật picking_task_items
7. Pack → status PACKING
8. Tạo shipment → SHIPPED
9. Giao hàng xong → COMPLETED
```

### Flow 5 — Billing (đang phát triển)

```
1. Cuối kỳ (tháng), system gen invoice cho từng tenant
2. Tính phí dựa trên storage_usage_snapshots × pricing_policies
3. Tenant thanh toán → record payment
4. Invoice status: DRAFT → ISSUED → PAID / OVERDUE
```

---

## 20. Docker & deployment

### `docker-compose.yml`

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: warehouse_admin
      POSTGRES_PASSWORD: SP26SE040@!
      POSTGRES_DB: smart_warehouse
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"

  app:
    build: .
    environment:
      NODE_ENV: production
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
    ports:
      - "3000:3000"
    depends_on:
      - postgres

volumes:
  pgdata:
```

### Deploy lên cloud (VPS / Railway / Render)

1. Set tất cả biến môi trường trên dashboard cloud (giống `.env`).
2. Set `NODE_ENV=production`.
3. Trỏ `POSTGRES_HOST` về managed DB (Supabase / Neon / RDS / Railway PG).
4. Build & run: `node server.js`.
5. Bật HTTPS (Cloudflare hoặc Nginx + Let's Encrypt).
6. Cấu hình CORS origins thực tế của FE.

### Healthcheck cho orchestrator

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 5s
  retries: 3
```

---

## 21. Troubleshooting

### `ECONNREFUSED 127.0.0.1:5432`

Postgres chưa chạy. Tuỳ cách cài:

- **Windows installer**: mở `services.msc` → start `postgresql-x64-XX`.
- **Docker**: `docker compose up -d postgres`.
- **Linux**: `sudo systemctl start postgresql`.
- **macOS (Homebrew)**: `brew services start postgresql@16`.

### `EADDRINUSE: address already in use 0.0.0.0:3000`

Còn process node cũ bám port:

```bash
# Windows
taskkill //F //IM node.exe

# macOS / Linux
lsof -i :3000      # tìm PID
kill -9 <PID>
```

### `Error: Cannot find module 'dotenv'`

Thiếu `node_modules`. Chạy `npm install`.

### Swagger không hiện endpoint mới sau khi sửa `openapi.js`

1. Ctrl + F5 trên tab Swagger (hard refresh).
2. Mở DevTools → Network → tick "Disable cache".
3. Verify spec backend đã đúng: `curl http://localhost:3000/api-docs.json | grep <path>`.
4. Nếu spec backend đúng nhưng UI sai → restart browser hoặc thử incognito.

### Seed script báo lỗi `duplicate key value violates unique constraint`

Một số seed script đời cũ chưa idempotent. Chạy `npm run db:reset` rồi seed lại từ đầu.

### Email OTP không tới Gmail

- Check `EMAIL_APP_PASSWORD` đúng định dạng (16 ký tự, có/không space đều OK).
- Check Gmail "Less secure apps" — Google đã tắt; phải dùng App Password.
- Check spam folder.
- Check console log: nếu thấy `Mail sent: <messageId>` là server đã gửi đi, vấn đề ở phía nhận.

---

## 22. Quy trình đóng góp (Contributing)

### Branching

- `main` — code chạy được, deploy được. Bảo vệ branch.
- `develop` — tích hợp các feature.
- `feature/<scope>-<short-desc>` — ví dụ `feature/outbound-request-crud`.
- `fix/<scope>-<bug>` — ví dụ `fix/auth-otp-expired`.
- `hotfix/<urgent>` — fix production.

### Commit message — Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

`type` ∈ `feat | fix | refactor | docs | chore | test | style | perf`.

Ví dụ:

```
feat(outbound-request): crud api

- Add service/controller/route mirroring inbound
- Add OUTBOUND_STATUS constant
- Update OpenAPI with OutboundRequest schema
```

### Pull Request checklist

- [ ] Code build & run được local.
- [ ] Đã test endpoint mới qua Swagger / curl / Postman.
- [ ] OpenAPI đã update (nếu thay đổi API).
- [ ] `docs/request.md` đã thêm ví dụ (nếu là API public cho FE).
- [ ] Không commit `.env` thật, không commit `node_modules`.
- [ ] Branch rebase lên `develop` mới nhất, không có conflict.

### Code review

- Tối thiểu 1 reviewer cùng team.
- Reviewer focus:
  - Có lộ thông tin nhạy cảm trong response không?
  - Service có check authorize đủ không?
  - SQL có nguy cơ injection (string concat) không?
  - Có ghi inventory_movement cho mọi thay đổi tồn kho không?

---

## 23. Roadmap

### Đã hoàn thành

- [x] DB schema bản 4 (24 tables, 10 enum).
- [x] Auth — login / register / change-password (OTP).
- [x] User management.
- [x] Warehouse structure CRUD (warehouse → zone → rack → level → bin).
- [x] Tenant onboarding flow (rental request → contract → storage reservation).
- [x] Product master (category / season / collection / SKU / batch).
- [x] LPN + LPN detail + rack suggestion.
- [x] Inbound request CRUD.
- [x] **Outbound request CRUD** (mới).
- [x] OpenAPI 3.0 đầy đủ 49 paths.
- [x] Seed scripts idempotent.

### Đang làm

- [ ] Inbound / Outbound request items CRUD riêng (tách khỏi parent).
- [ ] Picking task + Shipment lifecycle.
- [ ] Inventory & inventory_movement service layer.
- [ ] WebSocket realtime (notification khi inbound được duyệt).

### Sắp tới

- [ ] Billing engine (invoice gen tự động).
- [ ] Pricing policy per zone + season.
- [ ] AI slot recommendation (gắn vào model serving).
- [ ] Analytics dashboard (occupancy, throughput, SLA).
- [ ] Mobile-friendly endpoint cho WH_STAFF (scan barcode).
- [ ] Multi-warehouse transfer.
- [ ] Audit log full-text search.

---

## 24. Glossary — Thuật ngữ nghiệp vụ

| Thuật ngữ | Viết tắt | Định nghĩa |
|-----------|----------|------------|
| Stock Keeping Unit | SKU | Đơn vị nhỏ nhất quản lý hàng (vd: áo thun đỏ size M) |
| License Plate Number | LPN | Mã định danh 1 carton/pallet hàng |
| Warehouse | WH | Kho vật lý |
| Zone | — | Vùng trong kho (ambient/cold/quarantine/return) |
| Rack | — | Kệ |
| Rack Level | — | Tầng trong kệ |
| Bin | — | Ô lưu nhỏ nhất, chứa 1 hoặc vài LPN |
| Inbound | IN | Nhập kho |
| Outbound | OUT | Xuất kho |
| Put-away | — | Đưa LPN từ khu nhận về bin lưu trữ |
| Picking | — | Lấy hàng theo outbound request |
| Packing | — | Đóng gói trước khi ship |
| Shipment | SHP | Giao hàng |
| Tenant | — | Brand thuê kho |
| Contract | — | Hợp đồng thuê giữa warehouse và tenant |
| Rental Request | RR | Đơn xin thuê (tiền-contract) |
| Storage Reservation | — | Slot dành riêng cho 1 tenant trong 1 zone/rack |
| Inventory Movement | IM | Bản ghi mọi thay đổi tồn kho (audit log) |
| Batch | — | Lô hàng nhập 1 lần (gắn 1 inbound_request) |
| Occupancy | — | Tỉ lệ chiếm dụng (bin đang dùng / tổng bin) |
| OTP | — | One-Time Password (6 số, TTL 5 phút) |
| 3PL | — | Third-Party Logistics (dịch vụ kho thuê ngoài) |
| WMS | — | Warehouse Management System |
| FIFO / FEFO | — | First In First Out / First Expired First Out |
| ATP | — | Available To Promise (số lượng có thể bán) |
| SLA | — | Service Level Agreement |

---

## 25. License

ISC © 2026 SP26SE040 Capstone Team — GSP26SE110 Capstone Project, FPT University.

---

## Team

| Tên | Role | GitHub |
|-----|------|--------|
| (đang cập nhật) | Backend Lead | @— |
| (đang cập nhật) | Backend Dev | @— |
| (đang cập nhật) | Frontend Lead | @— |
| (đang cập nhật) | Frontend Dev | @— |
| (đang cập nhật) | UI/UX | @— |
| (đang cập nhật) | Mentor | @— |

---

## Liên hệ & support

- Issue tracker: https://github.com/GSP26SE110-Capstone-Project/Warehouse_BE_V2/issues
- Discussion: tạo issue với label `question`.
- Email maintainer: (đang cập nhật).

---

> **Lưu ý cho thành viên mới:** Đọc kỹ section [13. Convention](#13-convention--coding-style) trước khi mở PR đầu tiên. Mọi thay đổi DB phải đi qua migration script trong `scripts/sql/`. Đừng sửa trực tiếp DB production.

> Happy shipping! 🚚📦
