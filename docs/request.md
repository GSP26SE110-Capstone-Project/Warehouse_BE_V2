# API Request Body — Smart Warehouse API

## Authentication & Users

Base: `/api/auth`, `/api/users` — các route `/users/*` (trừ login) cần header:

`Authorization: Bearer <accessToken>`

### Phân quyền tạo user

| Người tạo | Được tạo role |
|-----------|----------------|
| `SYSTEM_ADMIN` | `WH_ADMIN`, `TENANT_ADMIN` |
| `WH_ADMIN` | `WH_STAFF` (cùng `warehouseId`) |
| `TENANT_ADMIN` | `TENANT_STAFF` (cùng `tenantId`) |

### `POST /auth/login`

```json
{
  "email": "admin@warehouse.local",
  "password": "Admin@12345"
}
```

Response `data`: `{ "accessToken": "...", "user": { ... } }`

### `POST /users` — Tạo user

**SYSTEM_ADMIN → WH_ADMIN**

```json
{
  "fullName": "Kho trưởng HCM",
  "email": "whadmin@warehouse.local",
  "password": "WhAdmin@12345",
  "role": "WH_ADMIN",
  "warehouseId": "uuid-warehouse"
}
```

**SYSTEM_ADMIN → TENANT_ADMIN**

```json
{
  "fullName": "Tenant Admin A",
  "email": "tenantadmin@brand.local",
  "password": "Tenant@12345",
  "role": "TENANT_ADMIN",
  "tenantId": "uuid-tenant"
}
```

**WH_ADMIN → WH_STAFF** (không cần `warehouseId`, tự gán theo admin)

```json
{
  "fullName": "Nhân viên kho",
  "email": "staff@warehouse.local",
  "password": "Staff@12345",
  "role": "WH_STAFF"
}
```

**TENANT_ADMIN → TENANT_STAFF**

```json
{
  "fullName": "Nhân viên tenant",
  "email": "tenantstaff@brand.local",
  "password": "Staff@12345",
  "role": "TENANT_STAFF"
}
```

### User endpoints khác

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/users/me` | Profile đang đăng nhập |
| GET | `/users?role=&status=` | List (theo scope role) |
| GET | `/users/:userId` | Chi tiết |
| PATCH | `/users/:userId` | `fullName`, `phone`, `status` |

Seed admin lần đầu: `npm run seed:admin`

---

# Warehouse Structure (Flow 2)

Base URL: `http://localhost:3000/api`

- **POST / PATCH**: `Content-Type: application/json`
- **GET list**: query `page` (mặc định `1`), `limit` (mặc định `20`, tối đa `100`)
- Field dùng **camelCase**
- Cập nhật dùng **PATCH** (không có PUT)

## Tất cả endpoint (flat)

| Resource | POST | GET list | GET one | PATCH | DELETE |
|----------|------|----------|---------|-------|--------|
| Warehouse | `/warehouses` | `/warehouses` | `/warehouses/:warehouseId` | `/warehouses/:warehouseId` | `/warehouses/:warehouseId` |
| Zone | `/zones` | `/zones?warehouseId=` | `/zones/:zoneId` | `/zones/:zoneId` | `/zones/:zoneId` |
| Rack | `/racks` | `/racks?zoneId=` | `/racks/:rackId` | `/racks/:rackId` | `/racks/:rackId` |
| Rack level | `/rack-levels` | `/rack-levels?rackId=` | `/rack-levels/:rackLevelId` | `/rack-levels/:rackLevelId` | `/rack-levels/:rackLevelId` |
| Bin | `/bins` | `/bins?rackLevelId=` | `/bins/:binId` | `/bins/:binId` | `/bins/:binId` |

**Quan hệ cha–con:** POST gửi ID cha trong **body**; GET list truyền ID cha trong **query**.

---

## 1. Warehouse

### `POST /warehouses`

| Field | Bắt buộc | Mặc định | Ghi chú |
|-------|----------|----------|---------|
| `warehouseCode` | ✅ | — | Unique |
| `warehouseName` | ✅ | — | |
| `address` | | — | |
| `totalAreaM2` | | — | |
| `usableAreaM2` | | — | |
| `status` | | `ACTIVE` | `ACTIVE`, `INACTIVE`, `MAINTENANCE`, `CLOSED` |

```json
{
  "warehouseCode": "WH-HCM-01",
  "warehouseName": "Kho HCM Trung tâm",
  "address": "Quận 7, TP.HCM",
  "totalAreaM2": 5000,
  "usableAreaM2": 4200,
  "status": "ACTIVE"
}
```

### `GET /warehouses`

Query: `status`, `page`, `limit`

### `PATCH /warehouses/:warehouseId`

```json
{
  "warehouseName": "Kho HCM (mở rộng)",
  "usableAreaM2": 4500
}
```

---

## 2. Zone

### `POST /zones`

| Field | Bắt buộc | Mặc định | Ghi chú |
|-------|----------|----------|---------|
| `warehouseId` | ✅ | — | UUID kho cha |
| `zoneCode` | ✅ | — | Unique trong warehouse |
| `zoneName` | | — | |
| `zoneType` | | `SHARED` | `SHARED`, `FAST_MOVING`, `BULK`, `PREMIUM`, `QC`, `RETURN` |
| `areaM2` | | — | |
| `isDedicated` | | `false` | |
| `status` | | `ACTIVE` | `ACTIVE`, `BLOCKED` |

```json
{
  "warehouseId": "uuid-warehouse",
  "zoneCode": "Z-A01",
  "zoneName": "Khu shared A",
  "zoneType": "SHARED",
  "areaM2": 500,
  "isDedicated": false,
  "status": "ACTIVE"
}
```

### `GET /zones?warehouseId={uuid}`

Query bắt buộc: `warehouseId`. Tùy chọn: `status`, `zoneType`, `page`, `limit`

### `PATCH /zones/:zoneId`

```json
{
  "zoneName": "Khu A (cập nhật)",
  "zoneType": "FAST_MOVING"
}
```

---

## 3. Rack

### `POST /racks`

| Field | Bắt buộc | Mặc định | Ghi chú |
|-------|----------|----------|---------|
| `zoneId` | ✅ | — | UUID zone cha |
| `rackCode` | ✅ | — | Unique trong zone |
| `rackType` | | `STANDARD` | `STANDARD`, `HIGH_CAPACITY` |
| `maxLevels` | | — | ≥ 1 |
| `status` | | `ACTIVE` | `ACTIVE`, `BLOCKED` |

```json
{
  "zoneId": "uuid-zone",
  "rackCode": "R-A01-01",
  "rackType": "STANDARD",
  "maxLevels": 4,
  "status": "ACTIVE"
}
```

### `GET /racks?zoneId={uuid}`

Query bắt buộc: `zoneId`. Tùy chọn: `status`, `rackType`, `page`, `limit`

### `PATCH /racks/:rackId`

```json
{
  "maxLevels": 5,
  "status": "ACTIVE"
}
```

---

## 4. Rack Level

### `POST /rack-levels`

| Field | Bắt buộc | Ghi chú |
|-------|----------|---------|
| `rackId` | ✅ | UUID rack cha |
| `levelNumber` | ✅ | ≥ 1, unique trong rack |
| `levelCode` | | |
| `maxBins` | | ≥ 0 |
| `maxWeightKg` | | ≥ 0 |
| `heightCm` | | ≥ 0 |
| `levelPriority` | | ≥ 0 |

```json
{
  "rackId": "uuid-rack",
  "levelCode": "L-01",
  "levelNumber": 1,
  "maxBins": 10,
  "maxWeightKg": 500,
  "heightCm": 180,
  "levelPriority": 1
}
```

### `GET /rack-levels?rackId={uuid}`

Query bắt buộc: `rackId`. Tùy chọn: `page`, `limit`

### `PATCH /rack-levels/:rackLevelId`

```json
{
  "maxBins": 12,
  "maxWeightKg": 600
}
```

---

## 5. Bin

### `POST /bins`

| Field | Bắt buộc | Mặc định | Ghi chú |
|-------|----------|----------|---------|
| `rackLevelId` | ✅ | — | UUID level cha |
| `binCode` | ✅ | — | Unique trong level |
| `maxLpnCount` | ✅ | — | ≥ 1 |
| `maxVolumeUnits` | ✅ | — | ≥ 1 |
| `supportedBoxType` | | — | `SMALL`, `MEDIUM`, `LARGE`, `EXTRA` |
| `maxOwnerCount` | | `3` | ≥ 1 |
| `reservationType` | | `SHARED` | `SHARED`, `RESERVED`, `DEDICATED` |
| `status` | | `EMPTY` | `EMPTY`, `PARTIAL`, `FULL`, `RESERVED`, `BLOCKED` |

```json
{
  "rackLevelId": "uuid-rack-level",
  "binCode": "B-A01-L1-01",
  "supportedBoxType": "MEDIUM",
  "maxLpnCount": 4,
  "maxVolumeUnits": 8,
  "maxOwnerCount": 3,
  "reservationType": "SHARED",
  "status": "EMPTY"
}
```

### `GET /bins?rackLevelId={uuid}`

Query bắt buộc: `rackLevelId`. Tùy chọn: `status`, `reservationType`, `supportedBoxType`, `page`, `limit`

### `PATCH /bins/:binId`

```json
{
  "maxLpnCount": 6,
  "status": "EMPTY",
  "reservationType": "RESERVED"
}
```

---

## Ví dụ flow tạo cấu trúc kho

```http
POST /api/warehouses
POST /api/zones              { "warehouseId": "..." }
POST /api/racks              { "zoneId": "..." }
POST /api/rack-levels        { "rackId": "..." }
POST /api/bins               { "rackLevelId": "..." }
```

Đọc chi tiết từng entity chỉ cần ID:

```http
GET /api/zones/{zoneId}
GET /api/racks/{rackId}
GET /api/rack-levels/{rackLevelId}
GET /api/bins/{binId}
```

---

# Tenant Onboarding (Flow 1)

Base URL: `http://localhost:3000/api`

Áp dụng cùng convention với Flow 2:

- **POST / PATCH**: `Content-Type: application/json`, body camelCase
- **GET list**: query `page` (mặc định `1`), `limit` (mặc định `20`, tối đa `100`)
- Cập nhật dùng **PATCH** (không có PUT)
- Quan hệ cha–con: POST gửi ID cha trong **body**; GET list truyền ID cha/lọc trong **query**

## Tất cả endpoint (flat)

| Resource | POST | GET list | GET one | PATCH | DELETE |
|----------|------|----------|---------|-------|--------|
| Rental request | `/rental-requests` | `/rental-requests?warehouseId=&status=` | `/rental-requests/:rentalRequestId` | `/rental-requests/:rentalRequestId` | `/rental-requests/:rentalRequestId` |
| Tenant company | `/tenants` | `/tenants?status=` | `/tenants/:tenantId` | `/tenants/:tenantId` | `/tenants/:tenantId` |
| Contract | `/contracts` | `/contracts?tenantId=&warehouseId=&rentalRequestId=&status=&contractType=` | `/contracts/:contractId` | `/contracts/:contractId` | `/contracts/:contractId` |
| Contract item | `/contract-items` | `/contract-items?contractId=` | `/contract-items/:contractItemId` | `/contract-items/:contractItemId` | `/contract-items/:contractItemId` |
| Storage reservation | `/storage-reservations` | `/storage-reservations?contractId=&tenantId=&warehouseId=&storageLevel=&status=` | `/storage-reservations/:reservationId` | `/storage-reservations/:reservationId` | `/storage-reservations/:reservationId` |

## Enum tham chiếu

| Enum | Giá trị |
|------|---------|
| `rentalRequest.status` | `PENDING`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `CONVERTED` |
| `contract.status` | `DRAFT`, `PENDING_APPROVAL`, `ACTIVE`, `EXPIRED`, `TERMINATED`, `CANCELLED` |
| `tenant.status` | `ACTIVE`, `SUSPENDED` |
| `contractType` | `SHARED_STORAGE`, `RESERVED_STORAGE`, `DEDICATED_ZONE`, `DEDICATED_WAREHOUSE` |
| `pricingModel` | `USAGE_BASED`, `FIXED`, `HYBRID` |
| `billingCycle` | `DAILY`, `MONTHLY`, `QUARTERLY` |
| `billingUnit` | `BOX_DAY`, `BIN_DAY`, `RACK_DAY`, `ZONE_DAY`, `WAREHOUSE_DAY`, `INBOUND_LPN`, `OUTBOUND_LPN`, `HANDLING_UNIT` |
| `contractItem.itemType` | `STORAGE`, `INBOUND`, `OUTBOUND`, `HANDLING`, `REPACKING`, `SLA` |
| `storageLevel` | `WAREHOUSE`, `ZONE`, `RACK`, `RACK_LEVEL`, `BIN` |
| `reservation.type` | `SHARED`, `RESERVED`, `DEDICATED` |
| `reservation.status` | `ACTIVE`, `EXPIRED`, `CANCELLED` |
| `boxType` | `SMALL`, `MEDIUM`, `LARGE`, `EXTRA` |

---

## 6. Rental Request

### `POST /rental-requests`

| Field | Bắt buộc | Mặc định | Ghi chú |
|-------|----------|----------|---------|
| `warehouseId` | ✅ | — | UUID kho |
| `companyName` | ✅ | — | |
| `requestCode` | | auto `RR-…` | Unique; tự sinh nếu bỏ trống |
| `companyCode` | | — | |
| `taxCode` | | — | |
| `address` | | — | |
| `contactName` | | — | |
| `contactEmail` | | — | |
| `contactPhone` | | — | |
| `contractType` | | — | enum `contractType` |
| `pricingModel` | | — | enum `pricingModel` |
| `billingCycle` | | — | enum `billingCycle` |
| `estimatedSkuCount` | | — | ≥ 0 |
| `estimatedBoxCount` | | — | ≥ 0 |
| `estimatedVolume` | | — | ≥ 0 |
| `averageStorageDays` | | — | ≥ 0 |
| `estimatedInboundPerWeek` | | — | ≥ 0 |
| `estimatedOutboundPerWeek` | | — | ≥ 0 |
| `requiresFastPicking` | | `false` | |
| `requiresPremiumStorage` | | `false` | |
| `suggestedZoneType` | | — | enum zone type |
| `suggestedRackType` | | — | enum rack type |
| `expectedStartDate` | | — | ISO datetime |
| `expectedEndDate` | | — | ISO datetime |
| `notes` | | — | |
| `status` | | `PENDING` | enum `rentalRequest.status` |

```json
{
  "warehouseId": "uuid-warehouse",
  "companyName": "ABC Fashion JSC",
  "companyCode": "ABC-FS",
  "taxCode": "0312345678",
  "address": "Quận 1, TP.HCM",
  "contactName": "Nguyễn Văn A",
  "contactEmail": "ceo@abc-fashion.vn",
  "contactPhone": "0901234567",
  "contractType": "SHARED_STORAGE",
  "pricingModel": "USAGE_BASED",
  "billingCycle": "MONTHLY",
  "estimatedSkuCount": 1200,
  "estimatedBoxCount": 4500,
  "estimatedVolume": 350.5,
  "averageStorageDays": 30,
  "estimatedInboundPerWeek": 4,
  "estimatedOutboundPerWeek": 10,
  "requiresFastPicking": true,
  "requiresPremiumStorage": false,
  "suggestedZoneType": "FAST_MOVING",
  "suggestedRackType": "STANDARD",
  "expectedStartDate": "2026-06-01T00:00:00Z",
  "expectedEndDate": "2027-06-01T00:00:00Z",
  "notes": "Có thể cần thêm khu PREMIUM cho dòng cao cấp"
}
```

### `GET /rental-requests`

Query tuỳ chọn: `warehouseId`, `status`, `contractType`, `pricingModel`, `page`, `limit`

### `PATCH /rental-requests/:rentalRequestId`

Dùng để cập nhật hồ sơ + xử lý workflow review:

| Status flow | Body gợi ý |
|-------------|------------|
| Bắt đầu review | `{ "status": "UNDER_REVIEW", "reviewedBy": "uuid-user" }` |
| Approve | `{ "status": "APPROVED", "reviewedBy": "uuid-user", "reviewedAt": "2026-05-19T08:00:00Z", "reviewNote": "OK" }` |
| Reject | `{ "status": "REJECTED", "reviewedBy": "uuid-user", "rejectionReason": "Hồ sơ thiếu tax code" }` |
| Đã tạo tenant + contract | `{ "status": "CONVERTED" }` |

Các field thông tin (`companyName`, `contactEmail`, `estimated*`, `suggested*`, …) cũng có thể PATCH cùng.

---

## 7. Tenant Company

### `POST /tenants`

| Field | Bắt buộc | Mặc định | Ghi chú |
|-------|----------|----------|---------|
| `companyName` | ✅ | — | |
| `companyCode` | | — | Unique |
| `taxCode` | | — | Unique |
| `contactName` | | — | |
| `contactEmail` | | — | |
| `contactPhone` | | — | |
| `address` | | — | |
| `status` | | `ACTIVE` | `ACTIVE`, `SUSPENDED` |

```json
{
  "companyName": "ABC Fashion JSC",
  "companyCode": "ABC-FS",
  "taxCode": "0312345678",
  "contactName": "Nguyễn Văn A",
  "contactEmail": "ceo@abc-fashion.vn",
  "contactPhone": "0901234567",
  "address": "Quận 1, TP.HCM",
  "status": "ACTIVE"
}
```

### `GET /tenants`

Query tuỳ chọn: `status`, `page`, `limit`

### `PATCH /tenants/:tenantId`

```json
{
  "contactPhone": "0907777777",
  "status": "SUSPENDED"
}
```

---

## 8. Contract

### `POST /contracts`

| Field | Bắt buộc | Mặc định | Ghi chú |
|-------|----------|----------|---------|
| `tenantId` | ✅ | — | UUID tenant |
| `warehouseId` | ✅ | — | UUID kho |
| `contractType` | ✅ | — | enum `contractType` |
| `pricingModel` | ✅ | — | enum `pricingModel` |
| `startDate` | ✅ | — | `YYYY-MM-DD` |
| `endDate` | ✅ | — | `YYYY-MM-DD`, phải sau `startDate` |
| `contractCode` | | auto `CTR-…` | Unique; tự sinh nếu bỏ trống |
| `contractName` | | — | |
| `rentalRequestId` | | — | UUID rental request; **1-1 unique**, đã link → 409 |
| `billingCycle` | | `MONTHLY` | |
| `allowDynamicRelocation` | | `true` | |
| `autoRenew` | | `false` | |
| `minimumBillingDays` | | `1` | ≥ 0 |
| `minimumReservedCapacity` | | — | ≥ 0 |
| `estimatedTotalAmount` | | — | ≥ 0 |
| `status` | | `DRAFT` | enum `contract.status` |
| `tenantSignature` | | — | |
| `warehouseSignature` | | — | |
| `createdBy` | | — | UUID user |
| `approvedBy` | | — | UUID user |

```json
{
  "tenantId": "uuid-tenant",
  "warehouseId": "uuid-warehouse",
  "rentalRequestId": "uuid-rental-request",
  "contractName": "HĐ thuê kho HCM - ABC Fashion",
  "contractType": "SHARED_STORAGE",
  "pricingModel": "USAGE_BASED",
  "billingCycle": "MONTHLY",
  "allowDynamicRelocation": true,
  "autoRenew": false,
  "startDate": "2026-06-01",
  "endDate": "2027-06-01",
  "minimumBillingDays": 30,
  "minimumReservedCapacity": 100,
  "estimatedTotalAmount": 240000000,
  "status": "DRAFT"
}
```

### `GET /contracts`

Query tuỳ chọn: `tenantId`, `warehouseId`, `rentalRequestId`, `status`, `contractType`, `page`, `limit`

### `PATCH /contracts/:contractId`

Dùng cho cả workflow ký HĐ:

| Bước | Body gợi ý |
|------|------------|
| Submit để duyệt | `{ "status": "PENDING_APPROVAL" }` |
| Tenant ký | `{ "tenantSignature": "<chữ ký số>" }` |
| Warehouse ký + approve | `{ "warehouseSignature": "<chữ ký số>", "approvedBy": "uuid-user", "status": "ACTIVE" }` |
| Huỷ / kết thúc | `{ "status": "TERMINATED" }` hoặc `{ "status": "CANCELLED" }` |

---

## 9. Contract Item

### `POST /contract-items`

| Field | Bắt buộc | Mặc định | Ghi chú |
|-------|----------|----------|---------|
| `contractId` | ✅ | — | UUID contract |
| `itemType` | ✅ | — | enum `contractItem.itemType` |
| `billingUnit` | ✅ | — | enum `billingUnit` |
| `unitPrice` | ✅ | — | ≥ 0 |
| `storageLevel` | | — | enum `storageLevel` |
| `quantity` | | — | ≥ 0 |
| `reservedQuantity` | | — | ≥ 0 |
| `boxType` | | — | enum `boxType` |

```json
{
  "contractId": "uuid-contract",
  "itemType": "STORAGE",
  "storageLevel": "BIN",
  "billingUnit": "BIN_DAY",
  "quantity": 50,
  "reservedQuantity": 50,
  "boxType": "MEDIUM",
  "unitPrice": 12000
}
```

### `GET /contract-items?contractId={uuid}`

Query bắt buộc: `contractId`. Tuỳ chọn: `page`, `limit`

### `PATCH /contract-items/:contractItemId`

```json
{
  "quantity": 60,
  "unitPrice": 11000
}
```

---

## 10. Storage Reservation

`tenantId` được kế thừa tự động từ `contract.tenantId` — không truyền trong body.

FK theo `storageLevel`:

| `storageLevel` | Bắt buộc kèm |
|----------------|--------------|
| `WAREHOUSE` | `warehouseId` |
| `ZONE` | `warehouseId`, `zoneId` |
| `RACK` | `warehouseId`, `rackId` |
| `RACK_LEVEL` | `warehouseId`, `rackLevelId` |
| `BIN` | `warehouseId`, `binId` |

### `POST /storage-reservations`

| Field | Bắt buộc | Mặc định | Ghi chú |
|-------|----------|----------|---------|
| `contractId` | ✅ | — | UUID contract |
| `reservationType` | ✅ | — | enum `reservation.type` |
| `storageLevel` | ✅ | — | enum `storageLevel` |
| `warehouseId` | ✅ | — | UUID kho |
| `startDate` | ✅ | — | `YYYY-MM-DD` |
| `endDate` | ✅ | — | `YYYY-MM-DD`, phải sau `startDate` |
| `zoneId` / `rackId` / `rackLevelId` / `binId` | (tuỳ level) | — | Bắt buộc theo bảng FK ở trên |
| `reservedCapacity` | | — | ≥ 0 |
| `boxType` | | — | enum `boxType` |
| `status` | | `ACTIVE` | `ACTIVE`, `EXPIRED`, `CANCELLED` |

**Ví dụ — reserve nguyên 1 zone (DEDICATED_ZONE):**

```json
{
  "contractId": "uuid-contract",
  "reservationType": "DEDICATED",
  "storageLevel": "ZONE",
  "warehouseId": "uuid-warehouse",
  "zoneId": "uuid-zone",
  "reservedCapacity": 500,
  "startDate": "2026-06-01",
  "endDate": "2027-06-01"
}
```

**Ví dụ — reserve theo bin (RESERVED_STORAGE):**

```json
{
  "contractId": "uuid-contract",
  "reservationType": "RESERVED",
  "storageLevel": "BIN",
  "warehouseId": "uuid-warehouse",
  "binId": "uuid-bin",
  "boxType": "MEDIUM",
  "reservedCapacity": 8,
  "startDate": "2026-06-01",
  "endDate": "2027-06-01"
}
```

### `GET /storage-reservations`

Query tuỳ chọn: `contractId`, `tenantId`, `warehouseId`, `zoneId`, `rackId`, `rackLevelId`, `binId`, `storageLevel`, `status`, `page`, `limit`

### `PATCH /storage-reservations/:reservationId`

Chỉ cho cập nhật: `reservationType`, `reservedCapacity`, `boxType`, `startDate`, `endDate`, `status` (đổi `storageLevel`/FK đích → tạo reservation mới).

```json
{
  "reservedCapacity": 600,
  "endDate": "2027-12-31"
}
```

---

## Ví dụ flow Tenant Onboarding (Flow 1)

```http
# 1. Tenant submit rental request
POST /api/rental-requests
    { "warehouseId": "...", "companyName": "ABC Fashion", ... }

# 2. WH_ADMIN review → APPROVED
PATCH /api/rental-requests/{rentalRequestId}
    { "status": "UNDER_REVIEW", "reviewedBy": "..." }
PATCH /api/rental-requests/{rentalRequestId}
    { "status": "APPROVED", "reviewedAt": "...", "reviewNote": "OK" }

# 3. Tạo tenant company
POST /api/tenants
    { "companyName": "ABC Fashion JSC", ... }

# 4. Tạo contract gắn rental_request_id
POST /api/contracts
    { "tenantId": "...", "warehouseId": "...",
      "rentalRequestId": "...", "contractType": "SHARED_STORAGE", ... }

# 5. Thêm các dòng giá / item
POST /api/contract-items
    { "contractId": "...", "itemType": "STORAGE",
      "billingUnit": "BIN_DAY", "unitPrice": 12000, ... }

# 6. Ký HĐ → ACTIVE
PATCH /api/contracts/{contractId}
    { "tenantSignature": "...", "warehouseSignature": "...",
      "approvedBy": "...", "status": "ACTIVE" }

# 7. Assign storage reservation theo storage_level
POST /api/storage-reservations
    { "contractId": "...", "reservationType": "RESERVED",
      "storageLevel": "BIN", "warehouseId": "...", "binId": "...",
      "startDate": "...", "endDate": "..." }

# 8. Activate tenant + đóng rental request
PATCH /api/tenants/{tenantId}            { "status": "ACTIVE" }
PATCH /api/rental-requests/{rentalRequestId}   { "status": "CONVERTED" }
```
