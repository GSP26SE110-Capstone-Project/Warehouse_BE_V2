# Architecture — NextGen Warehouse Backend

Tài liệu mô tả chi tiết kiến trúc của Warehouse_BE_V2: vì sao chọn pattern này, các tầng (layer), cách dữ liệu chảy qua hệ thống, và quyết định kỹ thuật quan trọng.

## Mục lục

- [1. Tóm tắt kiến trúc](#1-tóm-tắt-kiến-trúc)
- [2. Sơ đồ tầng (layered)](#2-sơ-đồ-tầng-layered)
- [3. Request lifecycle](#3-request-lifecycle)
- [4. Module dependency map](#4-module-dependency-map)
- [5. Quyết định kỹ thuật (ADR)](#5-quyết-định-kỹ-thuật-adr)
- [6. Models layer — chi tiết](#6-models-layer--chi-tiết)
- [7. Services layer — chi tiết](#7-services-layer--chi-tiết)
- [8. Controllers layer — chi tiết](#8-controllers-layer--chi-tiết)
- [9. Routes & Middleware](#9-routes--middleware)
- [10. Utilities (Cross-cutting)](#10-utilities-cross-cutting)
- [11. Config & Bootstrap](#11-config--bootstrap)
- [12. Data flow ví dụ](#12-data-flow-ví-dụ)
- [13. Error propagation](#13-error-propagation)
- [14. Concurrency model](#14-concurrency-model)
- [15. Scaling strategy](#15-scaling-strategy)
- [16. Observability (logging / metrics)](#16-observability)
- [17. Hướng phát triển kiến trúc](#17-hướng-phát-triển-kiến-trúc)

---

## 1. Tóm tắt kiến trúc

**Warehouse_BE_V2** là một **monolithic REST API** chạy trên Node.js + Express, lưu trữ PostgreSQL. Backend đóng vai trò "single source of truth" cho toàn bộ logic nghiệp vụ warehouse management.

### Nguyên tắc

1. **Layered architecture** — tách rõ Models / Services / Controllers / Routes.
2. **API-first** — mọi nghiệp vụ expose qua REST, có OpenAPI doc.
3. **Stateless** — server không lưu session; auth bằng JWT.
4. **Multi-tenant** — data isolation qua `tenantId` filter ở service layer.
5. **Database as source of truth** — không cache logic phức tạp ở Node.

### Không phải

- ❌ Không phải microservices — quá nhỏ để chia.
- ❌ Không event-driven — Kafka/RabbitMQ chưa cần.
- ❌ Không CQRS — read và write dùng cùng model.
- ❌ Không GraphQL — REST đủ cho FE hiện tại.

> Các quyết định này có thể thay đổi khi traffic tăng. Xem [section 15 — Scaling strategy](#15-scaling-strategy).

---

## 2. Sơ đồ tầng (layered)

```
┌──────────────────────────────────────────────────────────────┐
│                       Presentation Layer                      │
│  (Routes + Controllers — Express)                             │
│  - Parse req, format res                                      │
│  - HTTP semantics (status code, header)                       │
│  - Không chứa business logic                                  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                        Business Layer                         │
│  (Services)                                                   │
│  - Business rules (vd: contract phải ACTIVE)                  │
│  - Orchestration (gọi nhiều model + external service)         │
│  - Validation & normalization                                 │
│  - Transaction boundary                                       │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                       Data Access Layer                       │
│  (Models — BaseModel/SchemaModel + pg driver)                 │
│  - CRUD thuần                                                 │
│  - SQL generation                                             │
│  - Field mapping camel ↔ snake                                │
│  - Không biết về business rules                               │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                       Persistence Layer                       │
│  (PostgreSQL)                                                 │
│  - Tables, indexes, enums, constraints                        │
│  - Data integrity (FK, NOT NULL, UNIQUE)                      │
└──────────────────────────────────────────────────────────────┘
```

### Cross-cutting (cắt ngang)

```
┌──────────────────────────────────────────────────────────────┐
│  Config (db, jwt, mail, swagger)                              │
│  Middleware (authenticate, authorize, asyncHandler, error)    │
│  Utils (AppError, apiResponse, validate, password, otpStore)  │
│  Constants (enums)                                            │
└──────────────────────────────────────────────────────────────┘
```

Các module này được dùng xuyên suốt qua nhiều tầng.

---

## 3. Request lifecycle

Khi client gọi `POST /api/outbound-requests`:

```
1. HTTP Request đến Node process
   │
2. Express body-parser parse JSON
   │
3. CORS middleware check origin
   │
4. Logger middleware ghi log request
   │
5. Router routes/index.js → /api/outbound-requests
   │
6. authenticate middleware decode JWT
   │  - Nếu invalid → throw AppError(401)
   │  - Nếu ok → gán req.user = { userId, role, tenantId, ... }
   │
7. authorize middleware check role (nếu có)
   │  - Nếu không có permission → throw AppError(403)
   │
8. Controller outboundRequestController.create
   │  - Parse req.body
   │  - Gọi service
   │
9. Service outboundRequestService.createOutboundRequest
   │  - Validate input (pickFields, parseUuid, assertEnum)
   │  - Check business rules (contract ACTIVE)
   │  - Gọi nhiều model nếu cần
   │
10. Model OutboundRequest.create
    │  - Build INSERT SQL
    │  - Map camelCase → snake_case
    │  - Execute via pool
    │
11. PostgreSQL thực thi
    │  - Check FK constraint
    │  - Check UNIQUE (outbound_code)
    │  - Insert row, return RETURNING *
    │
12. Model nhận row, map snake_case → camelCase
    │
13. Service trả object cho controller
    │
14. Controller gọi created(res, data, msg)
    │  - apiResponse format: { success, message, data }
    │  - res.status(201).json(...)
    │
15. errorHandler middleware (nếu có throw trong bất kỳ bước nào)
    │  - Map AppError / PgError / JWTError → JSON response
    │
16. Response trả về client
```

### Bảng đặc trưng từng bước

| Bước | File | Layer |
|------|------|-------|
| 1-4 | `app.js`, `server.js` | Bootstrap |
| 5 | `routes/index.js`, `routes/outboundRequest.routes.js` | Presentation |
| 6 | `middleware/authenticate.js` | Cross-cutting |
| 7 | `middleware/authorize.js` | Cross-cutting |
| 8 | `controllers/outboundRequest.controller.js` | Presentation |
| 9 | `services/outboundRequest.service.js` | Business |
| 10 | `models/OutboundRequest.js` → `BaseModel.js` | Data Access |
| 11 | PostgreSQL | Persistence |
| 14 | `utils/apiResponse.js` | Cross-cutting |
| 15 | `middleware/errorHandler.js` | Cross-cutting |

---

## 4. Module dependency map

```
                          ┌──────────────┐
                          │  server.js   │
                          └──────┬───────┘
                                 │ import
                                 ▼
                          ┌──────────────┐
                          │   app.js     │
                          └──────┬───────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
       ┌────────────┐    ┌────────────┐    ┌──────────────┐
       │ middleware │    │   config   │    │   routes/    │
       └─────┬──────┘    └─────┬──────┘    └──────┬───────┘
             │                 │                  │
             └───────┬─────────┘                  ▼
                     │                     ┌─────────────┐
                     ▼                     │ controllers │
              ┌─────────────┐              └──────┬──────┘
              │   utils/    │                     │
              └──────┬──────┘                     ▼
                     │                     ┌─────────────┐
                     └─────────────────────│  services/  │
                                           └──────┬──────┘
                                                  │
                                                  ▼
                                           ┌─────────────┐
                                           │   models/   │
                                           └──────┬──────┘
                                                  │
                                                  ▼
                                           ┌─────────────┐
                                           │ config/db.js│
                                           └─────────────┘
```

### Quy tắc import (acyclic)

| Tầng | Được import | Không được import |
|------|-------------|-------------------|
| `models/` | `config/db.js`, `utils/` | controllers, services, routes |
| `services/` | `models/`, `utils/`, `constants/`, `config/mail.js` | controllers, routes, app.js |
| `controllers/` | `services/`, `utils/` | models trực tiếp, routes |
| `routes/` | `controllers/`, `middleware/` | services trực tiếp |
| `middleware/` | `utils/`, `config/jwt.js` | controllers, services, routes |
| `utils/` | (chỉ external + utils khác) | bất kỳ layer nào khác |

> Vi phạm dependency rule → đổi ngược tầng → khó test, vòng tròn import.

---

## 5. Quyết định kỹ thuật (ADR)

### ADR-001: Chọn Express thay vì Fastify / NestJS

**Quyết định**: dùng Express 5.x.

**Lý do**:

- Team mixed level — Express dễ học nhất.
- Ecosystem rộng — middleware đầy đủ.
- Express 5 hỗ trợ async handler native.
- Performance đủ cho scale dự kiến của capstone.

**Trade-off**: ít opinionated → cần tự định nghĩa convention.

### ADR-002: Không dùng ORM (Sequelize/Prisma/TypeORM)

**Quyết định**: viết wrapper `BaseModel` + `SchemaModel` trên `pg`.

**Lý do**:

- Team muốn hiểu SQL.
- Tối ưu query dễ hơn (raw SQL khi cần).
- Tránh black-box behavior của ORM.
- Schema migration đi qua plain SQL file → DBA dễ review.

**Trade-off**: phải viết nhiều boilerplate cho mỗi model.

**Mitigation**: utility `defineModel` + `fieldMapper` giảm boilerplate đáng kể.

### ADR-003: JWT stateless thay vì session

**Quyết định**: JWT trong header `Authorization: Bearer`.

**Lý do**:

- Stateless → scale horizontal dễ.
- FE web + mobile dùng chung được.
- Không cần Redis cho session storage (tiết kiệm hạ tầng).

**Trade-off**: không revoke ngay được — token vẫn valid tới khi expire.

**Mitigation**:

- TTL ngắn (7 ngày).
- Sẽ thêm refresh token + blacklist cho production.

### ADR-004: OpenAPI viết tay thay vì JSDoc

**Quyết định**: `src/docs/openapi.js` là plain JS object.

**Lý do**:

- JSDoc parser chậm + dễ lỗi format.
- Plain JS dễ refactor, có IntelliSense.
- Single file → grep / search nhanh.

**Trade-off**: phải sync tay khi đổi endpoint. Đã đưa vào PR checklist.

### ADR-005: OTP in-memory

**Quyết định**: `Map` trong process memory.

**Lý do**:

- Đơn giản, không thêm dependency.
- Đủ cho 1 instance.

**Trade-off**: multi-instance không share state.

**Plan**: thay bằng Redis khi deploy nhiều instance.

### ADR-006: Số file controller / route / service tăng tuyến tính theo domain

**Quyết định**: 1 domain = 4 file (model + service + controller + route).

**Lý do**:

- Dễ navigate.
- File nhỏ, dễ review.

**Trade-off**: nhiều file → cần discipline trong naming.

### ADR-007: snake_case ở DB, camelCase ở JS

**Quyết định**: tự động mapping qua `fieldMapper`.

**Lý do**:

- Convention chuẩn 2 ngôn ngữ.
- DB SQL dễ đọc.
- JS code dễ đọc.

**Trade-off**: cần helper. Đã có sẵn.

### ADR-008: Idempotent seed

**Quyết định**: mọi seed script có thể chạy lại không sinh dữ liệu trùng.

**Lý do**:

- Onboard dev mới: chạy seed nhiều lần không sợ.
- CI/CD: chạy seed sau deploy mà không break.

**Implementation**:

- `INSERT ... ON CONFLICT DO UPDATE` cho bảng có unique key.
- `SELECT ... WHERE ...; nếu null thì INSERT` cho bảng không có unique key tự nhiên.

---

## 6. Models layer — chi tiết

### `BaseModel.js`

Class cơ sở, cung cấp CRUD chung. Mọi model kế thừa từ đây.

API:

```js
class BaseModel {
  constructor(tableName, primaryKey) { ... }

  async findById(id) { ... }
  async findOne(filters) { ... }
  async findAll(filters, { orderBy, limit, offset } = {}) { ... }
  async count(filters = {}) { ... }
  async create(data) { ... }
  async updateById(id, data) { ... }
  async deleteById(id) { ... }
  async exists(filters) { ... }
}
```

Internal:

- Build SQL với parameterised query.
- Auto `RETURNING *` cho INSERT/UPDATE/DELETE.
- Bắt error PG mapping sang `AppError` (DUPLICATE, FK_VIOLATION,...) qua `errorHandler`.

### `SchemaModel.js`

Mở rộng `BaseModel`, dùng **schema** để:

- Validate required fields ở `create`.
- Map field name camel ↔ snake tự động.
- Hỗ trợ default value (`'NOW()'`).

### `defineModel(tableName, schema)`

Factory:

```js
import defineModel from './defineModel.js';

export const outboundRequestSchema = { ... };
const OutboundRequest = defineModel('outbound_requests', outboundRequestSchema);
export default OutboundRequest;
```

Trả về 1 instance `SchemaModel` đã cấu hình sẵn.

### `utils/fieldMapper.js`

Hai hàm chính:

```js
camelToSnake('tenantId')           // → 'tenant_id'
snakeToCamel('tenant_id')          // → 'tenantId'

mapKeysCamelToSnake({ tenantId: 'x' })  // → { tenant_id: 'x' }
mapKeysSnakeToCamel({ tenant_id: 'x' }) // → { tenantId: 'x' }
```

Áp dụng:

- **Input** (data từ user) → `mapKeysCamelToSnake` trước khi gen SQL.
- **Output** (row từ pg) → `mapKeysSnakeToCamel` trước khi trả về service.

### Schema spec

```js
const schema = {
  fieldName: {
    type: 'string' | 'number' | 'boolean' | 'datetime' | 'json',
    primaryKey: true,           // optional
    required: true,             // optional, dùng cho validate
    unique: true,               // hint cho doc
    foreignKey: 'other_table_id', // hint cho doc
    default: 'NOW()',           // optional, dùng cho create
  },
  // ...
};
```

> Schema dùng chính cho code mapping. Constraint thực tế (NOT NULL, FK) vẫn ở DB.

---

## 7. Services layer — chi tiết

### Trách nhiệm

- **Validate** input (`parseUuid`, `assertEnum`, `pickFields`).
- **Normalize** data (parse date, trim, default value).
- **Business rules** (vd: contract phải ACTIVE).
- **Orchestration** (gọi nhiều model + external service).
- **Throw** `AppError` khi business rule fail.

### Cấu trúc 1 service file

```js
import Model from '../models/Model.js';
import AppError from '../utils/AppError.js';
import { ENUM_LIST } from '../constants/...';
import { assertEnum, parseUuid } from '../utils/validate.js';

// 1. Allowed fields (whitelist)
const CREATE_FIELDS = [ ... ];
const UPDATE_FIELDS = [ ... ];

// 2. Helpers (private — không export)
function pickFields(source, fields) { ... }
function generateCode() { ... }
function parseDateTime(value, fieldName) { ... }

// 3. Business rule checks
async function assertSomeRule(...) { ... }

// 4. Normalize
function normalizeCreatePayload(body) { ... }
function normalizeUpdatePayload(body) { ... }

// 5. Public API
export async function getEntity(id) { ... }
export async function listEntities(query) { ... }
export async function createEntity(body) { ... }
export async function updateEntity(id, body) { ... }
export async function deleteEntity(id) { ... }
```

### Quy tắc

- Tên hàm export theo dạng `<verb><Entity>`: `createOutboundRequest`, `getInboundRequest`.
- Mỗi hàm trả về Promise → controller `await`.
- Hàm `get*` ném 404 khi không tìm thấy (không trả null).
- Hàm `list*` luôn trả `{ items, meta }`.
- Trong service nội bộ có thể gọi nhau (vd: `createOutboundRequest` gọi `getContract`).

### Cross-service call

Khi service A cần data từ domain B:

```js
// services/outboundRequest.service.js
import { getContract } from './contract.service.js';
import { getTenantCompany } from './tenantCompany.service.js';

async function assertContractForOutbound(tenantId, contractId, warehouseId) {
  const contract = await getContract(contractId);
  // ...
}
```

> Cross-service call **được phép** vì cùng tầng business. Nhưng đừng để vòng tròn (A→B, B→A).

---

## 8. Controllers layer — chi tiết

### Trách nhiệm

- Parse `req.params`, `req.query`, `req.body`.
- Gọi 1 hàm service tương ứng.
- Format response qua `success` / `created` / `paginated`.
- KHÔNG validate phức tạp (chuyện đó của service).
- KHÔNG try/catch — đã có `asyncHandler` + `errorHandler`.

### Template chuẩn

```js
import * as entityService from '../services/entity.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const result = await entityService.listEntities({
    ...req.query,
    page,
    limit,
    offset,
  });
  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const entity = await entityService.getEntity(req.params.entityId);
  success(res, entity);
}

export async function create(req, res) {
  const entity = await entityService.createEntity(req.body);
  created(res, entity);
}

export async function update(req, res) {
  const entity = await entityService.updateEntity(
    req.params.entityId,
    req.body
  );
  success(res, entity, 'Updated successfully');
}

export async function remove(req, res) {
  const entity = await entityService.deleteEntity(req.params.entityId);
  success(res, entity, 'Deleted successfully');
}
```

### Khi nào controller có nhiều hơn 5 hàm?

Khi có action đặc biệt:

```js
export async function approve(req, res) { ... }
export async function reject(req, res) { ... }
export async function cancel(req, res) { ... }
```

Vẫn giữ controller mỏng — gọi service.

---

## 9. Routes & Middleware

### Routes

`src/routes/<domain>.routes.js`:

```js
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import * as controller from '../controllers/<domain>.controller.js';

const router = Router();

router.post('/',
  authenticate,
  authorize('SYSTEM_ADMIN', 'WH_ADMIN'),
  asyncHandler(controller.create)
);
router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.getById));
router.patch('/:id',
  authenticate,
  asyncHandler(controller.update)
);
router.delete('/:id',
  authenticate,
  authorize('SYSTEM_ADMIN'),
  asyncHandler(controller.remove)
);

export default router;
```

### Mount

`src/routes/index.js`:

```js
import express from 'express';
import outboundRequestRoutes from './outboundRequest.routes.js';
// ...

const router = express.Router();
router.use('/outbound-requests', outboundRequestRoutes);
// ...
export default router;
```

`src/app.js`:

```js
import apiRoutes from './routes/index.js';
app.use('/api', apiRoutes);
```

### Middleware order

```js
app.use(cors(...));
app.use(express.json({ limit: '10mb' }));
app.use(logger);            // request logger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
app.use('/api', apiRoutes);
app.use(notFound);          // 404
app.use(errorHandler);      // global error — phải cuối cùng
```

> Order **rất quan trọng**: errorHandler luôn cuối cùng để bắt mọi throw.

### `asyncHandler` — pattern

```js
export default function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

Wrap mọi async controller → khi throw thì `next(err)` được gọi → `errorHandler` bắt.

### `authenticate` — pattern

```js
export default function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Missing token', 401, 'NO_TOKEN');
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
  }
}
```

### `authorize` — pattern

```js
export default function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) throw new AppError('Not authenticated', 401, 'NOT_AUTH');
    if (!roles.includes(req.user.role)) {
      throw new AppError(
        `Required role: ${roles.join(', ')}`,
        403,
        'FORBIDDEN'
      );
    }
    next();
  };
}
```

---

## 10. Utilities (Cross-cutting)

### `AppError.js`

```js
export default class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}
```

### `apiResponse.js`

```js
export function success(res, data, message = 'Success') {
  res.status(200).json({ success: true, message, data });
}

export function created(res, data, message = 'Created') {
  res.status(201).json({ success: true, message, data });
}

export function paginated(res, data, meta) {
  res.status(200).json({ success: true, data, meta });
}

export function fail(res, statusCode, code, message) {
  res.status(statusCode).json({ success: false, code, message });
}
```

### `validate.js`

```js
export function parseUuid(value, fieldName) { ... }
export function assertEnum(value, allowed, fieldName) { ... }
export function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  return { page, limit, offset: (page - 1) * limit };
}
export function pickFields(source, fields) { ... }
```

### `otpStore.js`

In-memory Map:

```js
const store = new Map();
// key = userId, value = { hashedOtp, expiresAt, attempts, payload }

export function saveOtp(userId, { otp, ttlMs, payload }) {
  store.set(userId, {
    hashedOtp: sha256(otp),
    expiresAt: Date.now() + ttlMs,
    attempts: 0,
    payload,
  });
}

export function verifyOtp(userId, otp) {
  const record = store.get(userId);
  if (!record) throw new AppError('OTP not found', 400, 'OTP_NOT_FOUND');
  if (Date.now() > record.expiresAt) {
    store.delete(userId);
    throw new AppError('OTP expired', 400, 'OTP_EXPIRED');
  }
  record.attempts++;
  if (record.attempts > 5) {
    store.delete(userId);
    throw new AppError('Too many attempts', 400, 'OTP_LOCKED');
  }
  if (sha256(otp) !== record.hashedOtp) {
    throw new AppError('Invalid OTP', 400, 'OTP_INVALID');
  }
  const payload = record.payload;
  store.delete(userId);   // single use
  return payload;
}
```

### `password.js`

```js
import bcrypt from 'bcrypt';

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
```

### `userPublic.js`

```js
export function toPublic(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}
```

---

## 11. Config & Bootstrap

### `server.js`

```js
import app from './src/app.js';
import { testConnection } from './src/config/db.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

// Test DB connection async, log result
testConnection().catch(console.error);
```

### `src/app.js`

Khởi tạo Express app, mount middleware. Không gọi `listen` — để dễ test với supertest.

### `src/config/db.js`

Pool config:

```js
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function testConnection(retries = 5) {
  for (let i = 1; i <= retries; i++) {
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('Database connected:', result.rows[0]);
      return;
    } catch (e) {
      console.log(`DB attempt ${i}/${retries} failed`);
      if (i < retries) await new Promise(r => setTimeout(r, 2000));
      else throw e;
    }
  }
}

export default pool;
```

### `src/config/jwt.js`

```js
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
```

### `src/config/mail.js`

Nodemailer transporter + template functions (xem `README.md` section 18).

### `src/config/swagger.js`

```js
import swaggerUi from 'swagger-ui-express';
import openapiSpec from '../docs/openapi.js';

export function setupSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
  app.get('/api-docs.json', (_, res) => res.json(openapiSpec));
  
  const pathCount = Object.keys(openapiSpec.paths || {}).length;
  console.log(`Swagger Docs: http://localhost:${process.env.PORT}/api-docs (${pathCount} paths)`);
}
```

---

## 12. Data flow ví dụ

### Ví dụ 1: Login

```
Client                                       Server                        DB
  │                                             │                            │
  │── POST /api/auth/login ──────────────────→  │                            │
  │   { email, password }                       │                            │
  │                                             │── User.findOne({email}) ─→ │
  │                                             │←──── row hoặc null ─────── │
  │                                             │                            │
  │                                             │── bcrypt.compare ─────→    │ (CPU work)
  │                                             │                            │
  │                                             │── jwt.sign(payload) ──→    │ (CPU work)
  │                                             │                            │
  │←─── 200 { success, data: { token, user } }──│                            │
```

### Ví dụ 2: Create outbound request (có validation chéo)

```
Client                                       Server                        DB
  │                                             │                            │
  │── POST /api/outbound-requests ───────────→  │                            │
  │   { tenantId, contractId, warehouseId,..} ──┐                            │
  │                                             ▼                            │
  │                                       authenticate                       │
  │                                       (decode JWT)                       │
  │                                             │                            │
  │                                  outboundRequestController.create        │
  │                                             │                            │
  │                                outboundRequestService.createOutbound     │
  │                                             │                            │
  │                                  normalizeCreatePayload (sync)           │
  │                                             │                            │
  │                                             ├── TenantCompany.findById──→│
  │                                             │←── row ─────────────────── │
  │                                             │                            │
  │                                             ├── Warehouse.findById ────→ │
  │                                             │←── row ─────────────────── │
  │                                             │                            │
  │                                             ├── Contract.findById ─────→ │
  │                                             │←── row ─────────────────── │
  │                                             │                            │
  │                                  assertContractForOutbound (sync)        │
  │                                  - tenant match? warehouse match?        │
  │                                  - status === 'ACTIVE'?                  │
  │                                             │                            │
  │                                             ├── OutboundRequest.create ─→│
  │                                             │←── new row ─────────────── │
  │                                             │                            │
  │←── 201 { success, data: { outboundRequestId,...} } ──                    │
```

### Ví dụ 3: Change password 2 bước

**Step 1 — request OTP:**

```
Client                          Server                  DB              Mail
  │                                │                     │                │
  │── POST /change-password ────→  │                     │                │
  │   { currentPwd, newPwd }       │                     │                │
  │                                ├── User.findById ──→ │                │
  │                                │←── user ─────────── │                │
  │                                │                     │                │
  │                                ├── bcrypt.compare    │                │
  │                                ├── hashPassword(new) │                │
  │                                ├── generateOtp()     │                │
  │                                ├── saveOtp(userId,   │                │
  │                                │    { otp, ttl,      │                │
  │                                │      newHash })     │                │
  │                                │                     │                │
  │                                ├── sendChangePasswordOtp ───────────→ │
  │                                │                     │                │
  │←── 200 "OTP sent to email" ─── │                     │                │
```

**Step 2 — verify OTP:**

```
Client                          Server                  DB
  │                                │                     │
  │── POST /change-password/verify │                     │
  │   { otp }                  ──→ │                     │
  │                                ├── verifyOtp(userId, │
  │                                │    otp) → payload   │
  │                                │  (throw nếu sai)    │
  │                                │                     │
  │                                ├── User.updateById ─→│
  │                                │   { passwordHash:   │
  │                                │     payload.hash }  │
  │                                │←── updated ─────────│
  │                                │                     │
  │                                ├── clearOtp(userId)  │
  │                                │                     │
  │←── 200 { changedAt: now } ──── │                     │
```

---

## 13. Error propagation

### Chain

```
Service throw new AppError(...)
        │
        ▼
Controller (không try/catch)
        │
        ▼
asyncHandler bắt Promise reject → next(err)
        │
        ▼
errorHandler middleware:
  - if err instanceof AppError → format
  - else if err.code (pg) → map sang AppError → format
  - else → 500 INTERNAL_ERROR
        │
        ▼
res.status(...).json({ success: false, ... })
```

### Bảng mapping PG → AppError

| PG code | Meaning | → AppError |
|---------|---------|------------|
| `23505` | unique_violation | 409 `DUPLICATE` |
| `23503` | foreign_key_violation | 400 `FK_VIOLATION` |
| `23502` | not_null_violation | 400 `MISSING_FIELD` |
| `23514` | check_violation | 400 `CHECK_VIOLATION` |
| `22P02` | invalid_text_representation | 400 `INVALID_INPUT` |
| `42P01` | undefined_table | 500 `SCHEMA_ERROR` |
| `42703` | undefined_column | 500 `SCHEMA_ERROR` |
| `08006` | connection_failure | 503 `DB_UNAVAILABLE` |

### Stack trace trong dev mode

```js
if (process.env.NODE_ENV === 'development') {
  response.stack = err.stack;
}
```

Production tuyệt đối không trả `stack` (lộ source code).

---

## 14. Concurrency model

### Node single-threaded event loop

- Mọi request chia sẻ 1 process Node.
- I/O (DB query, mail send) là non-blocking.
- CPU work (bcrypt hash) **block event loop**.

### Lưu ý

- bcrypt rounds = 10 → khoảng 100ms / hash. Không quá nặng nhưng đừng quá nhiều concurrent login.
- JSON parse body limit `10mb` để tránh DoS.
- Connection pool max 20 → khoảng 20 query concurrent.

### Race condition

Hiện tại không có locking. Risk:

- 2 user tạo cùng lúc 2 inbound với cùng `inboundCode` → 1 bị DUPLICATE → ổn.
- 2 user pick cùng lúc 1 LPN → cần lock ở picking_tasks (sẽ làm sau).

Pattern handling:

- Dùng UNIQUE constraint ở DB cho field cần exclusive.
- Catch DUPLICATE → retry với code mới.
- Long-running mutation → lock row qua `SELECT ... FOR UPDATE`.

---

## 15. Scaling strategy

### Hiện tại — Single node

- 1 Node process.
- 1 PG instance.
- OTP in-memory.
- Adequate cho < 100 user concurrent.

### Bước 1 — Vertical scale

- Tăng RAM Node (4 → 8 GB).
- Tăng pool size (20 → 50).
- PG instance lớn hơn.

### Bước 2 — Horizontal scale (multi-instance)

Cần thay đổi:

1. OTP store → Redis.
2. Rate limit → Redis-backed.
3. Session refresh token → DB (đã plan).
4. Logging → centralized (ELK / Datadog).
5. Reverse proxy (Nginx / ALB) với sticky session nếu cần.

Sau đó scale Node ngang qua PM2 / Kubernetes / Docker Swarm.

### Bước 3 — DB scale

- Read replica cho query GET.
- Connection pooler bên ngoài (PgBouncer).
- Partition table lớn (`inventory_movements`, `lpn_details`) theo `created_at` hoặc `tenant_id`.

### Bước 4 — Tách microservice (nếu cần)

Domain candidate tách trước:

- **Billing** — chạy job định kỳ, không cần realtime với core.
- **Analytics** — tính snapshot offline.
- **AI slot recommendation** — đã là Python service, gọi qua REST.

---

## 16. Observability

### Hiện tại

- `console.log` cho start, DB connect, request.

### Plan

- **Pino** logger structured JSON.
- **Request ID** middleware (uuid) → trace 1 request xuyên log.
- **Metrics** qua Prometheus exporter (`/metrics`):
  - `http_requests_total{method, path, status}`
  - `http_request_duration_seconds`
  - `db_pool_active`, `db_pool_idle`
  - `otp_active_count`
- **Tracing** OpenTelemetry → Jaeger (optional).
- **Health endpoint** đã có (`/api/health`).
- **Sentry** cho production error tracking.

---

## 17. Hướng phát triển kiến trúc

Theo thứ tự ưu tiên:

1. **Test infrastructure** — Vitest + Supertest. Coverage > 60%.
2. **CI/CD** — GitHub Actions: lint + test + build Docker image.
3. **Refresh token** — DB-backed, revocable.
4. **Audit log generic** — middleware ghi mọi mutation.
5. **Rate limit + bruteforce protection**.
6. **Pino logger** + request ID.
7. **OpenAPI auto-generate** từ schema (nếu thấy đỡ hơn manual).
8. **Multi-tenant data isolation** chặt hơn — Row Level Security trong PG?
9. **Cache layer** — Redis cho master data.
10. **Migration tool chuyên nghiệp** — `node-pg-migrate` hoặc `Knex migrate`.
11. **TypeScript migration** — sau khi MVP ổn định.
12. **Event-driven** — Kafka/RabbitMQ cho inventory movement.

---

> Cập nhật lần cuối: 2026-05-24. Mỗi khi đổi cấu trúc lớn, cập nhật file này và bump phiên bản trong commit message.
