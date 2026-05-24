# API Overview — Warehouse_BE_V2

Tài liệu cấp cao về API: convention, status code, response envelope, pagination, filtering, authentication, error codes. Dành cho FE team và mobile team.

## Mục lục

- [1. Base URL & versioning](#1-base-url--versioning)
- [2. Authentication](#2-authentication)
- [3. Response envelope](#3-response-envelope)
- [4. Pagination](#4-pagination)
- [5. Filtering & query params](#5-filtering--query-params)
- [6. HTTP status code](#6-http-status-code)
- [7. Error codes](#7-error-codes)
- [8. Date / time format](#8-date--time-format)
- [9. UUID format](#9-uuid-format)
- [10. Naming convention](#10-naming-convention)
- [11. Versioning chính sách](#11-versioning-chính-sách)
- [12. CORS](#12-cors)
- [13. Rate limiting (kế hoạch)](#13-rate-limiting-kế-hoạch)
- [14. Health check](#14-health-check)
- [15. Resource quick reference](#15-resource-quick-reference)

---

## 1. Base URL & versioning

| Env | URL |
|-----|-----|
| Local | `http://localhost:3000/api` |
| Staging | `https://staging-warehouse.example.com/api` |
| Production | `https://api.warehouse.example.com/api` |

API hiện tại không có version trong URL (`v1`). Khi có breaking change, sẽ thêm `/api/v2/...`.

OpenAPI spec: `<base>/api-docs.json`.
Swagger UI: `<base>/api-docs/`.

---

## 2. Authentication

### Header

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Lấy token

`POST /api/auth/login`:

```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

Response:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbG...",
    "user": {
      "userId": "uuid",
      "email": "user@example.com",
      "role": "TENANT_ADMIN",
      "tenantId": "uuid"
    }
  }
}
```

### JWT payload

```json
{
  "sub": "userId-uuid",
  "role": "TENANT_ADMIN",
  "tenantId": "uuid",
  "warehouseId": null,
  "email": "user@example.com",
  "iat": 1779614190,
  "exp": 1780218990
}
```

### TTL

7 ngày mặc định. Client nên lấy `exp` để cảnh báo user trước khi hết hạn.

### Khi token expired

Response:

```http
HTTP/1.1 401 Unauthorized
{
  "success": false,
  "code": "TOKEN_EXPIRED",
  "message": "Invalid or expired token"
}
```

FE redirect về login.

---

## 3. Response envelope

### Success — 1 record

```json
{
  "success": true,
  "message": "Success",
  "data": { ... }
}
```

### Success — created (201)

```json
{
  "success": true,
  "message": "Created",
  "data": { ... }
}
```

### Success — list (paginated)

```json
{
  "success": true,
  "data": [ { ... }, { ... }, ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 137,
    "totalPages": 7
  }
}
```

### Error

```json
{
  "success": false,
  "code": "NOT_FOUND",
  "message": "Resource not found"
}
```

Trong development có thêm `stack` để debug.

---

## 4. Pagination

Query params:

- `page` (number, default 1, min 1)
- `limit` (number, default 20, min 1, max 100)

Ví dụ: `GET /api/users?page=2&limit=50`.

Meta:

- `page`: trang hiện tại.
- `limit`: số record mỗi trang.
- `total`: tổng record (đã filter).
- `totalPages`: `Math.ceil(total / limit)`.

### Tips cho FE

- Show `Showing X-Y of Z` dùng `(page-1)*limit + 1` tới `min(page*limit, total)`.
- Hide button "Next" khi `page >= totalPages`.
- Reset về `page=1` khi đổi filter.

---

## 5. Filtering & query params

### Convention

Filter cụ thể theo từng endpoint, nhưng pattern chung:

- `<entity>Id` để lọc theo parent: `tenantId`, `warehouseId`, `contractId`, ...
- `status` để lọc theo enum.
- `code` để search exact theo mã (vd `inboundCode`).
- `q` (sẽ thêm) để search full-text — chưa support.
- `fromDate`, `toDate` (sẽ thêm) để filter theo time range — chưa support hết.

### Multiple values

Hiện tại mỗi param chỉ chấp nhận 1 giá trị. Nếu cần multi:

- Dùng query repeated: `?status=PENDING&status=APPROVED` — chưa parse tự động.
- Hoặc CSV: `?status=PENDING,APPROVED` — chưa parse tự động.

→ FE tạm thời gọi nhiều lần và merge client-side.

### Sort

Hiện tại default `created_at DESC`. Không expose qua query yet. Plan: `?sort=createdAt:desc,name:asc`.

---

## 6. HTTP status code

| Code | Khi nào trả |
|------|-------------|
| `200 OK` | GET / PATCH / DELETE thành công, có body |
| `201 Created` | POST thành công, có body |
| `204 No Content` | Hiếm dùng — đa số endpoint vẫn trả body |
| `400 Bad Request` | Validation error, input invalid |
| `401 Unauthorized` | Token thiếu / invalid / expired |
| `403 Forbidden` | Token hợp lệ nhưng role không đủ |
| `404 Not Found` | Resource không tồn tại |
| `409 Conflict` | Duplicate key (vd email đã tồn tại) |
| `422 Unprocessable Entity` | Validation logic complex (ít dùng — thường dùng 400) |
| `429 Too Many Requests` | (sẽ có) Rate limit hit |
| `500 Internal Server Error` | Bug server-side, log đầy đủ |
| `503 Service Unavailable` | DB / mail service down |

---

## 7. Error codes

Tất cả error có field `code` để FE switch logic. Bảng dưới đây liệt kê code phổ biến:

### Auth

| Code | HTTP | Nghĩa |
|------|------|-------|
| `NO_TOKEN` | 401 | Thiếu header `Authorization` |
| `INVALID_TOKEN` | 401 | Token sai format / signature |
| `TOKEN_EXPIRED` | 401 | Token hết hạn |
| `INVALID_CREDENTIALS` | 401 | Sai email/password |
| `FORBIDDEN` | 403 | Role không đủ |
| `ACCOUNT_INACTIVE` | 403 | User bị disable |

### Validation

| Code | HTTP | Nghĩa |
|------|------|-------|
| `VALIDATION_ERROR` | 400 | Generic validation fail |
| `MISSING_FIELD` | 400 | Required field thiếu |
| `INVALID_INPUT` | 400 | Input sai format |
| `INVALID_UUID` | 400 | Không phải UUID hợp lệ |
| `INVALID_ENUM` | 400 | Giá trị không thuộc enum |
| `INVALID_STATUS` | 400 | Status transition không hợp lệ |

### Resource

| Code | HTTP | Nghĩa |
|------|------|-------|
| `NOT_FOUND` | 404 | Resource không tồn tại |
| `DUPLICATE` | 409 | Unique constraint violation |
| `FK_VIOLATION` | 400 | Foreign key sai (parent không tồn tại) |
| `IN_USE` | 409 | Resource đang được dùng, không thể xoá |

### OTP

| Code | HTTP | Nghĩa |
|------|------|-------|
| `OTP_NOT_FOUND` | 400 | Không có OTP pending |
| `OTP_EXPIRED` | 400 | OTP hết hạn |
| `OTP_INVALID` | 400 | OTP sai |
| `OTP_LOCKED` | 400 | Vượt số lần nhập sai |

### System

| Code | HTTP | Nghĩa |
|------|------|-------|
| `INTERNAL_ERROR` | 500 | Lỗi không xác định |
| `DB_UNAVAILABLE` | 503 | Mất kết nối DB |
| `MAIL_FAILED` | 500 | Gửi email lỗi |
| `EXTERNAL_SERVICE_ERROR` | 502 | Lỗi từ Cloudinary, external API |

### Pattern xử lý FE

```typescript
async function callApi(...) {
  try {
    const res = await fetch(...);
    const body = await res.json();
    if (!body.success) {
      switch (body.code) {
        case 'TOKEN_EXPIRED':
        case 'INVALID_TOKEN':
          logout();
          redirectToLogin();
          break;
        case 'FORBIDDEN':
          toast.error('Bạn không có quyền truy cập');
          break;
        case 'NOT_FOUND':
          toast.error('Không tìm thấy dữ liệu');
          break;
        case 'DUPLICATE':
          toast.warn(body.message);
          break;
        default:
          toast.error(body.message || 'Lỗi không xác định');
      }
      throw new Error(body.message);
    }
    return body.data;
  } catch (e) {
    throw e;
  }
}
```

---

## 8. Date / time format

### Input (request body)

ISO 8601 UTC:

```
2026-05-28T10:00:00.000Z
2026-05-28T10:00:00Z
2026-05-28T17:00:00+07:00
```

Server parse hết được. Khuyến nghị dùng UTC `Z`.

### Output (response body)

Luôn UTC ISO 8601:

```json
{
  "createdAt": "2026-05-24T10:00:00.000Z"
}
```

### Date-only field

Hiện tại không có field nào chỉ date không time. Tất cả là `TIMESTAMPTZ`.

### FE convert sang local

```js
new Date('2026-05-28T10:00:00.000Z').toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
})
// → "28/05/2026, 17:00:00"
```

---

## 9. UUID format

Tất cả ID dạng UUID v4 (lowercase):

```
6cf26831-6939-49c9-a7ec-4136c62df999
```

### Validation

Server validate qua regex:

```
^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
```

### FE gen UUID

Khi tạo entity, FE **không** gen UUID — để server tự gen qua `gen_random_uuid()` của Postgres.

---

## 10. Naming convention

### URL

- Lowercase kebab-case: `/inbound-requests`, `/rack-levels`, `/storage-reservations`.
- Số nhiều: `/users`, không `/user`.
- Path param: `/users/:userId`, không `/users/:id` (rõ hơn khi nested).

### JSON keys

- camelCase: `tenantId`, `expectedArrivalDate`, `actualShippedAt`.
- ID field hậu tố `Id`: `userId`, `warehouseId` (không `user_id`).
- Boolean tiền tố: `isActive`, `hasItems`.

### Response

- Date suffix `At`: `createdAt`, `updatedAt`, `shippedAt`.
- Date-only suffix `Date`: `requestedShipDate`, `expectedArrivalDate`.

---

## 11. Versioning chính sách

### Hiện tại

API chưa version. Path là `/api/...`.

### Khi có breaking change

Sẽ giới thiệu `/api/v2/...`. Path cũ giữ ít nhất 3 tháng để FE/mobile migrate.

### Khi đổi shape response

- Thêm field: backward-compatible → không bump.
- Đổi tên field: breaking → cần coordinate.
- Xoá field: breaking → cần coordinate.

### Khi đổi enum

- Thêm value mới: backward-compatible nếu FE handle "unknown" gracefully.
- Đổi name value: breaking → cần coordinate.

---

## 12. CORS

### Hiện tại (development)

```js
cors({
  origin: '*',
  credentials: false,
});
```

→ Cho phép mọi origin gọi.

### Production

```js
cors({
  origin: [
    'https://app.warehouse.example.com',
    'https://admin.warehouse.example.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
});
```

→ FE phải gửi `credentials: 'include'` nếu dùng cookie. Hiện tại dùng JWT header → không cần.

---

## 13. Rate limiting (kế hoạch)

Plan implement với `express-rate-limit` + Redis store:

| Endpoint | Limit |
|----------|-------|
| `POST /api/auth/login` | 5 req / 5 phút / IP |
| `POST /api/auth/change-password` | 3 req / 5 phút / user |
| `POST /api/auth/change-password/verify` | 5 req / 5 phút / user |
| `POST /api/auth/register` | 3 req / phút / IP |
| Còn lại | 100 req / phút / IP |

Khi hit:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
{
  "success": false,
  "code": "RATE_LIMITED",
  "message": "Too many requests. Try again in 60 seconds."
}
```

FE handle:

- Disable button submit khi nhận 429.
- Đếm ngược `Retry-After` rồi enable lại.

---

## 14. Health check

`GET /api/health`:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "connected",
    "timestamp": "2026-05-24T10:00:00.000Z"
  }
}
```

Hoặc 503 nếu DB down:

```json
{
  "success": false,
  "code": "DB_UNAVAILABLE",
  "message": "Database unavailable"
}
```

Dùng cho:

- Load balancer health check.
- Monitoring (uptime check).
- Smoke test sau deploy.

---

## 15. Resource quick reference

| Resource | Endpoint root | Sample fields |
|----------|---------------|---------------|
| User | `/users` | `userId`, `email`, `fullName`, `role`, `tenantId`, `warehouseId`, `status` |
| Warehouse | `/warehouses` | `warehouseId`, `code`, `name`, `address`, `city` |
| Zone | `/zones` | `zoneId`, `warehouseId`, `code`, `name`, `zoneType` |
| Rack | `/racks` | `rackId`, `zoneId`, `code`, `rackType` |
| RackLevel | `/rack-levels` | `rackLevelId`, `rackId`, `levelNumber` |
| Bin | `/bins` | `binId`, `rackLevelId`, `code`, `status` |
| RentalRequest | `/rental-requests` | `rentalRequestId`, `tenantName`, `status`, `estimatedVolume` |
| TenantCompany | `/tenants` | `tenantId`, `tenantCode`, `companyName`, `contactEmail` |
| Contract | `/contracts` | `contractId`, `tenantId`, `warehouseId`, `contractCode`, `status`, `startDate`, `endDate` |
| ContractItem | `/contract-items` | `contractItemId`, `contractId`, `zoneId`, `quantity`, `unitPrice` |
| StorageReservation | `/storage-reservations` | `storageReservationId`, `tenantId`, `contractId`, `zoneId`, `rackId` |
| Category | `/categories` | `categoryId`, `code`, `name` |
| Season | `/seasons` | `seasonId`, `code`, `name`, `year` |
| Collection | `/collections` | `collectionId`, `tenantId`, `code`, `name`, `seasonId` |
| SKU | `/skus` | `skuId`, `tenantId`, `skuCode`, `name`, `categoryId`, `collectionId` |
| Batch | `/batches` | `batchId`, `inboundRequestId`, `batchCode`, `productionDate`, `expiryDate` |
| LPN | `/lpns` | `lpnId`, `tenantId`, `batchId`, `lpnCode`, `boxType`, `currentBinId`, `status` |
| LpnDetail | `/lpn-details` | `lpnDetailId`, `lpnId`, `skuId`, `quantity` |
| InboundRequest | `/inbound-requests` | `inboundRequestId`, `tenantId`, `contractId`, `warehouseId`, `inboundCode`, `status`, `expectedArrivalDate` |
| OutboundRequest | `/outbound-requests` | `outboundRequestId`, `tenantId`, `contractId`, `warehouseId`, `outboundCode`, `status`, `requestedShipDate` |

### Endpoint pattern chung

| Action | Method | Path |
|--------|--------|------|
| List | `GET` | `/resource?filter=&page=&limit=` |
| Get one | `GET` | `/resource/:id` |
| Create | `POST` | `/resource` |
| Update | `PATCH` | `/resource/:id` |
| Delete | `DELETE` | `/resource/:id` |

### Special actions (sẽ thêm)

| Action | Method | Path |
|--------|--------|------|
| Approve outbound | `POST` | `/outbound-requests/:id/approve` |
| Reject outbound | `POST` | `/outbound-requests/:id/reject` |
| Cancel | `POST` | `/outbound-requests/:id/cancel` |
| Create picking task | `POST` | `/outbound-requests/:id/picking-tasks` |
| Start receiving | `POST` | `/inbound-requests/:id/start-receiving` |
| Complete receiving | `POST` | `/inbound-requests/:id/complete` |

---

## Cheat sheet cho FE

### Auth flow

```
1. Login → lưu token vào memory + localStorage (HttpOnly cookie tốt hơn).
2. Mọi request: gắn header Authorization.
3. Trước khi mỗi request: check exp của token. Nếu sắp hết → refresh (sẽ có).
4. Nhận 401 → logout + redirect /login.
```

### CRUD form

```
1. Mount component → call GET /resource/:id để fetch initial.
2. User chỉnh → PATCH /resource/:id với chỉ field đã đổi.
3. Hiển thị message từ response.message.
4. Refetch hoặc update state local.
```

### List + filter

```
1. State { page, limit, filters }.
2. useEffect → call GET /resource?<params>.
3. Pagination component dùng meta.totalPages.
4. Filter change → reset page = 1, refetch.
```

### Notification on action

```
- 201 → toast "Tạo thành công"
- 200 (update/delete) → toast với response.message
- 4xx → toast warning với response.message
- 5xx → toast error generic + log Sentry
```

---

> Cập nhật: 2026-05-24. Khi thay đổi response shape hoặc thêm error code, cập nhật file này.
