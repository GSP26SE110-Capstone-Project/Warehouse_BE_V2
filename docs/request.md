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
