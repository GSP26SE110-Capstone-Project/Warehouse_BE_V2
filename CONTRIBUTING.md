# Contributing Guide — Warehouse_BE_V2

Cảm ơn bạn đã quan tâm tới việc đóng góp cho dự án **NextGen Warehouse**. Tài liệu này mô tả chi tiết quy trình làm việc, quy ước code, cách viết commit, mở PR, review code, và các "do / don't" để giữ codebase chất lượng.

## Mục lục

- [1. Trước khi bắt đầu](#1-trước-khi-bắt-đầu)
- [2. Cài đặt môi trường dev](#2-cài-đặt-môi-trường-dev)
- [3. Branching strategy](#3-branching-strategy)
- [4. Commit message — Conventional Commits](#4-commit-message--conventional-commits)
- [5. Pull Request workflow](#5-pull-request-workflow)
- [6. Code review checklist](#6-code-review-checklist)
- [7. Coding style](#7-coding-style)
- [8. Pattern khi thêm 1 domain mới](#8-pattern-khi-thêm-1-domain-mới)
- [9. Pattern khi thêm endpoint mới](#9-pattern-khi-thêm-endpoint-mới)
- [10. Pattern khi thêm bảng mới](#10-pattern-khi-thêm-bảng-mới)
- [11. Testing](#11-testing)
- [12. Anti-patterns — cần tránh](#12-anti-patterns--cần-tránh)
- [13. Security checklist](#13-security-checklist)
- [14. Performance tips](#14-performance-tips)
- [15. FAQ cho thành viên mới](#15-faq-cho-thành-viên-mới)

---

## 1. Trước khi bắt đầu

### Đọc kỹ các tài liệu nền

Trước khi mở PR đầu tiên, bạn nên đã đọc:

- `README.md` — overview + setup.
- `docs/flow.md` — các flow nghiệp vụ chính.
- `docs/db4.md` — DB schema.
- `docs/request.md` — ví dụ request/response cho FE.
- `ARCHITECTURE.md` — kiến trúc layered, quy ước import.
- File này (`CONTRIBUTING.md`).

### Cấu hình tài khoản GitHub

```bash
git config --global user.name "Tên Của Bạn"
git config --global user.email "your.email@example.com"
```

Nếu dùng nhiều account, set cục bộ trong repo:

```bash
git config user.name "Tên Của Bạn"
git config user.email "your.email@example.com"
```

### Mời mentor / lead review

Mọi PR đều cần ít nhất 1 reviewer từ team BE. PR đụng vào DB schema cần thêm lead approve.

---

## 2. Cài đặt môi trường dev

### Yêu cầu phần mềm

- Node.js 18+ (khuyến nghị 20 LTS).
- PostgreSQL 15+ (hoặc Docker).
- Git.
- Editor: VS Code (kèm extension Prettier, ESLint, dotenv, REST Client).

### Setup nhanh

```bash
git clone https://github.com/GSP26SE110-Capstone-Project/Warehouse_BE_V2.git
cd Warehouse_BE_V2
npm install
cp .env.example .env
# Sửa .env: POSTGRES_* + EMAIL_* + JWT_SECRET
npm run db:migrate
npm run seed:accounts
npm run seed:warehouse
npm run dev
```

Verify:

```bash
curl http://localhost:3000/api/health
# → { "success": true, "data": { "status": "ok", "database": "connected" } }
```

### Setup VS Code

`.vscode/settings.json` (đã commit sẵn — nếu chưa, tạo theo mẫu):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.tabSize": 2,
  "files.eol": "\n",
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,
  "javascript.preferences.importModuleSpecifier": "relative"
}
```

Cài extension đề xuất khi VS Code prompt.

---

## 3. Branching strategy

### Tên branch

| Loại | Pattern | Ví dụ |
|------|---------|-------|
| Feature mới | `feature/<scope>-<short-desc>` | `feature/outbound-request-crud` |
| Bug fix | `fix/<scope>-<short-desc>` | `fix/auth-jwt-expired-message` |
| Refactor | `refactor/<scope>-<desc>` | `refactor/service-validation-utils` |
| Docs | `docs/<scope>` | `docs/readme-deployment` |
| Hotfix | `hotfix/<urgent-issue>` | `hotfix/login-500` |
| Chore | `chore/<desc>` | `chore/upgrade-express` |

Quy tắc:

- Tất cả viết thường, không dấu, dùng dấu gạch ngang.
- `scope` là module hoặc domain (auth, inbound, contract,...).
- `short-desc` ≤ 5 từ.

### Workflow

```
main ─────────────────────────────────────────●─→
                                              │
            develop ─────────●─●─●─●─────────●─→
                            /  │  │  │       
       feature/inbound ────●   │  │  │       
                              /   │  │       
       feature/outbound ────●     │  │       
                                 /   │       
       fix/auth-otp ───────────●     │       
                                    /        
       chore/upgrade-pg ────────────●        
```

- `main`: chỉ merge từ `develop` qua release PR. Mọi commit đều đã được test trên staging.
- `develop`: tích hợp các feature đang phát triển.
- Feature branch: tách từ `develop`, merge ngược về `develop`.
- Hotfix: tách từ `main`, merge cả về `main` lẫn `develop`.

### Đồng bộ branch

Trước khi push:

```bash
git fetch origin
git rebase origin/develop
# fix conflict nếu có
git push --force-with-lease
```

> Dùng `--force-with-lease` thay vì `--force` để tránh đè commit của người khác.

---

## 4. Commit message — Conventional Commits

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

Constraints:

- `subject` ≤ 72 ký tự, viết thường, không chấm cuối.
- `body` mỗi dòng ≤ 100 ký tự, giải thích **why** chứ không phải **what**.
- `footer` chứa breaking change hoặc ref issue.

### Types

| Type | Khi nào dùng |
|------|--------------|
| `feat` | Thêm tính năng mới (endpoint, service, flow) |
| `fix` | Sửa bug |
| `refactor` | Đổi cấu trúc code, không đổi behavior |
| `perf` | Tối ưu hiệu năng |
| `docs` | Sửa tài liệu (`*.md`, JSDoc, comment) |
| `test` | Thêm/sửa test |
| `chore` | Update deps, config, script build |
| `style` | Format, đặt tên (không đổi logic) |
| `build` | Sửa Dockerfile, docker-compose |
| `ci` | Sửa CI pipeline |

### Scope đề xuất

- `auth`, `user`, `warehouse`, `zone`, `rack`, `bin`
- `rental-request`, `contract`, `tenant`, `storage-reservation`
- `inbound`, `outbound`, `picking`, `shipment`
- `sku`, `batch`, `lpn`, `category`, `season`, `collection`
- `inventory`, `movement`
- `billing`, `invoice`, `payment`
- `db`, `seed`, `migration`
- `docs`, `openapi`
- `deps`, `config`

### Ví dụ tốt

```
feat(outbound): crud api with contract validation

- Service kiểm contract ACTIVE và khớp tenant/warehouse
- Auto-generate outboundCode dạng OUT-<ts>-<rand>
- PATCH chỉ cho phép thay đổi status/ship-date/approver
```

```
fix(auth): otp not invalidated after successful change

OTP store sau khi password đổi xong vẫn còn record, dẫn tới
attacker biết userId có thể vô tình verify lại. Thêm clearOtp()
ngay sau khi update password thành công.

Refs: #142
```

```
docs(readme): add outbound section + glossary

Bổ sung hướng dẫn cho FE team.
```

### Ví dụ xấu — đừng làm thế

```
update                   ← quá mơ hồ
fix bug                  ← bug gì?
WIP                      ← đừng push WIP lên develop/main
asdf                     ← thật sự?
sửa code outbound        ← thiếu type, không có context
```

### Breaking change

Khi API thay đổi không backward-compatible:

```
feat(auth)!: change login response shape

Trả về { token, user } thay vì { accessToken, profile }.
FE cần update theo.

BREAKING CHANGE: response field name changed.
```

Dấu `!` sau scope báo hiệu breaking.

---

## 5. Pull Request workflow

### Trước khi mở PR — self-check

```bash
# 1. Code build & run được
npm install
npm run dev

# 2. Lint sạch (khi có ESLint)
# npm run lint

# 3. Test endpoint mới
# Swagger UI, curl, hoặc Postman

# 4. Sync với develop
git fetch origin
git rebase origin/develop

# 5. Push
git push -u origin feature/<...>
```

### Mở PR

Title: dùng commit message theo Conventional Commits.

Body — dùng template:

```markdown
## What

Tóm tắt thay đổi trong 2-3 câu.

## Why

Lý do — link issue nếu có (`Closes #123`).

## How

- Bullet 1
- Bullet 2

## Test plan

- [ ] Đã test trên Swagger UI
- [ ] Đã test edge case A
- [ ] Đã test với role X / Y / Z

## Screenshots (nếu có)

(paste image)

## Migration / Breaking change

- [ ] Có sửa DB schema → đã viết migration script chưa?
- [ ] Có thay đổi API shape → đã báo FE chưa?

## Checklist

- [ ] Commit message theo Conventional Commits
- [ ] OpenAPI đã update
- [ ] `docs/request.md` đã thêm ví dụ (nếu là API public)
- [ ] Không commit `.env` hoặc secret
- [ ] Đã rebase lên `develop` mới nhất
```

### Sau khi merge

- Xoá branch local + remote.
- Nếu là feature lớn → cập nhật roadmap trong `README.md`.

---

## 6. Code review checklist

Reviewer focus theo thứ tự ưu tiên:

### Cao — must check

- [ ] Có lộ thông tin nhạy cảm trong response không? (`password_hash`, `email` của user khác,...)
- [ ] Authorize đủ chưa? Tenant A có request được dữ liệu tenant B không?
- [ ] SQL có injection không? (string concat thay vì parameterised)
- [ ] Có ghi `inventory_movements` cho mọi thay đổi tồn kho không?
- [ ] Có gọi external service mà không có timeout không?
- [ ] Có throw `AppError` đúng status code không?

### Trung — should check

- [ ] Service có validate input bằng `parseUuid` / `assertEnum` / `pickFields` không?
- [ ] Controller có "mỏng" không? Có gọi DB trực tiếp không?
- [ ] Có dùng `asyncHandler` không? Hay đang `try/catch` thủ công?
- [ ] Naming có rõ ràng không? (đừng đặt `data1`, `tmp`, `x`)
- [ ] Có duplicate logic với service khác không?
- [ ] Có bỏ sót enum value khi validate không?

### Thấp — nice to have

- [ ] Có thể tách helper function để tái sử dụng?
- [ ] Có thể giảm số query DB?
- [ ] Có comment cho logic phức tạp không?
- [ ] OpenAPI có đủ example không?

### Phản hồi review

- Comment cần cụ thể: "đổi thành X vì Y" thay vì "không hay".
- Suggestion mode (GitHub) cho thay đổi nhỏ.
- Phân biệt rõ:
  - `[blocker]` — phải sửa mới merge.
  - `[nit]` — nhỏ, không bắt buộc.
  - `[question]` — chỉ hỏi để hiểu, không cản trở.

---

## 7. Coding style

### Naming

| Loại | Convention | Ví dụ |
|------|------------|-------|
| File | camelCase.js | `outboundRequest.service.js` |
| Folder | lowercase | `services/`, `routes/` |
| Class / Model | PascalCase | `OutboundRequest`, `BaseModel` |
| Function | camelCase | `createOutboundRequest`, `parseUuid` |
| Variable | camelCase | `tenantId`, `contractItems` |
| Constant | SCREAMING_SNAKE_CASE | `OUTBOUND_STATUS`, `MAX_LIMIT` |
| DB table / column | snake_case | `outbound_requests`, `tenant_id` |
| URL path | kebab-case | `/outbound-requests`, `/rack-levels` |
| Boolean | tiền tố `is/has/should` | `isActive`, `hasItems`, `shouldNotify` |

### Imports — thứ tự

```js
// 1. Third-party
import { Router } from 'express';

// 2. Config
import pool from '../config/db.js';

// 3. Models
import OutboundRequest from '../models/OutboundRequest.js';

// 4. Services
import { getContract } from './contract.service.js';

// 5. Utils
import AppError from '../utils/AppError.js';
import { assertEnum, parseUuid } from '../utils/validate.js';

// 6. Constants
import { OUTBOUND_STATUS } from '../constants/outbound.js';
```

### ESM (không CommonJS)

```js
// Đúng
import express from 'express';
export default router;

// Sai
const express = require('express');
module.exports = router;
```

### Async / await

Luôn dùng `async/await`, không `.then().catch()`:

```js
// Đúng
const user = await User.findById(id);
if (!user) throw new AppError('Not found', 404, 'NOT_FOUND');

// Tránh
User.findById(id).then(u => {...}).catch(e => {...});
```

### Error throwing

```js
// Đúng
throw new AppError('contractId is required', 400, 'VALIDATION_ERROR');

// Sai — không có statusCode/code
throw new Error('contractId is required');
```

### Đừng `console.log` trong service / controller

Dùng `console.log` chỉ trong:

- `server.js` lúc start.
- Scripts (`scripts/*.mjs`).
- Debug tạm — xoá trước khi commit.

Production logging sẽ có Pino / Winston sau.

---

## 8. Pattern khi thêm 1 domain mới

Giả sử bạn muốn thêm domain `Shipment` (chưa có).

### Bước 1: Schema DB

`scripts/sql/db4_schema.sql` đã có sẵn `shipments` (xem bảng). Nếu không, viết migration:

```sql
-- scripts/sql/2026_05_add_shipments.sql
CREATE TABLE IF NOT EXISTS shipments (
  shipment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_companies (tenant_id),
  outbound_request_id UUID NOT NULL REFERENCES outbound_requests (outbound_request_id),
  shipment_code VARCHAR(100) UNIQUE,
  carrier_name VARCHAR(255),
  tracking_number VARCHAR(255),
  status shipment_status_enum DEFAULT 'READY',
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Bước 2: Model

`src/models/Shipment.js`:

```js
import defineModel from './defineModel.js';

export const shipmentSchema = {
  shipmentId: { type: 'string', primaryKey: true },
  tenantId: { type: 'string', required: true, foreignKey: 'tenant_id' },
  outboundRequestId: { type: 'string', required: true, foreignKey: 'outbound_request_id' },
  shipmentCode: { type: 'string', unique: true },
  carrierName: { type: 'string' },
  trackingNumber: { type: 'string' },
  status: { type: 'string' },
  shippedAt: { type: 'datetime' },
  deliveredAt: { type: 'datetime' },
  createdAt: { type: 'datetime', default: 'NOW()' },
  updatedAt: { type: 'datetime' },
};

export const tableName = 'shipments';

const Shipment = defineModel(tableName, shipmentSchema);
export { Shipment };
export default Shipment;
```

### Bước 3: Constants

`src/constants/shipment.js`:

```js
export const SHIPMENT_STATUS = Object.freeze([
  'READY',
  'IN_TRANSIT',
  'DELIVERED',
  'RETURNED',
]);
```

### Bước 4: Service

`src/services/shipment.service.js`:

```js
import Shipment from '../models/Shipment.js';
import AppError from '../utils/AppError.js';
import { SHIPMENT_STATUS } from '../constants/shipment.js';
import { assertEnum, parseUuid } from '../utils/validate.js';

const CREATE_FIELDS = [
  'tenantId',
  'outboundRequestId',
  'shipmentCode',
  'carrierName',
  'trackingNumber',
  'status',
];

// ... pickFields, normalizeCreatePayload, ...

export async function createShipment(body) {
  const data = normalizeCreatePayload(body);
  return Shipment.create(data);
}

// ... list, getById, update, delete
```

### Bước 5: Controller

`src/controllers/shipment.controller.js`:

```js
import * as shipmentService from '../services/shipment.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const result = await shipmentService.listShipments({
    ...req.query,
    page,
    limit,
    offset,
  });
  paginated(res, result.items, result.meta);
}

// ... getById, create, update, remove
```

### Bước 6: Route

`src/routes/shipment.routes.js`:

```js
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as shipmentController from '../controllers/shipment.controller.js';

const router = Router();

router.post('/', asyncHandler(shipmentController.create));
router.get('/', asyncHandler(shipmentController.list));
router.get('/:shipmentId', asyncHandler(shipmentController.getById));
router.patch('/:shipmentId', asyncHandler(shipmentController.update));
router.delete('/:shipmentId', asyncHandler(shipmentController.remove));

export default router;
```

### Bước 7: Mount route

`src/routes/index.js`:

```js
import shipmentRoutes from './shipment.routes.js';
// ...
router.use('/shipments', shipmentRoutes);
```

### Bước 8: OpenAPI

`src/docs/openapi.js`:

```js
tags: [
  // ...
  { name: 'Shipment', description: 'Outbound shipments / delivery tracking' },
],

components: {
  schemas: {
    // ...
    Shipment: { ... },
    ShipmentCreate: { ... },
    ShipmentUpdate: { ... },
  },
},

paths: {
  // ...
  '/api/shipments': { get, post },
  '/api/shipments/{shipmentId}': { get, patch, delete },
},
```

### Bước 9: Docs cho FE

`docs/request.md`:

```markdown
## XX. Shipment

### `POST /shipments`
...
```

### Bước 10: Test thủ công

```bash
# Khởi tạo
curl -X POST http://localhost:3000/api/shipments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ ... }'

# Verify
curl http://localhost:3000/api/shipments
```

### Bước 11: Commit

Mỗi bước nên là 1 commit nếu domain lớn:

```bash
git commit -m "feat(shipment): add Shipment model + constants"
git commit -m "feat(shipment): add service with status validation"
git commit -m "feat(shipment): add controller + routes"
git commit -m "feat(shipment): document openapi + request.md"
```

---

## 9. Pattern khi thêm endpoint mới

Trong domain đã có, ví dụ thêm "approve outbound request":

### Service

```js
// src/services/outboundRequest.service.js
export async function approveOutboundRequest(outboundRequestId, approvedBy) {
  const outbound = await getOutboundRequest(outboundRequestId);

  if (outbound.status !== 'PENDING') {
    throw new AppError(
      `Cannot approve outbound in status ${outbound.status}`,
      400,
      'INVALID_STATUS'
    );
  }

  return OutboundRequest.updateById(outboundRequestId, {
    status: 'APPROVED',
    approvedBy: parseUuid(approvedBy, 'approvedBy'),
  });
}
```

### Controller

```js
// src/controllers/outboundRequest.controller.js
export async function approve(req, res) {
  const outbound = await outboundRequestService.approveOutboundRequest(
    req.params.outboundRequestId,
    req.user.userId
  );
  success(res, outbound, 'Outbound request approved');
}
```

### Route

```js
// src/routes/outboundRequest.routes.js
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';

router.post(
  '/:outboundRequestId/approve',
  authenticate,
  authorize('WH_ADMIN', 'SYSTEM_ADMIN'),
  asyncHandler(outboundRequestController.approve)
);
```

### OpenAPI

```js
'/api/outbound-requests/{outboundRequestId}/approve': {
  post: {
    tags: ['OutboundRequest'],
    summary: 'Approve a pending outbound request',
    security: [{ bearerAuth: [] }],
    parameters: [
      { in: 'path', name: 'outboundRequestId', required: true, schema: uuid },
    ],
    responses: {
      200: successEnvelope(
        { $ref: '#/components/schemas/OutboundRequest' },
        'Outbound request approved'
      ),
      400: stdErrors[400],
      401: stdErrors[401],
      403: stdErrors[403],
      404: stdErrors[404],
    },
  },
},
```

---

## 10. Pattern khi thêm bảng mới

### Quy trình bắt buộc

1. **Thiết kế trên giấy / Miro**: vẽ ERD, xác định FK, index, enum.
2. **Review với team** trước khi viết SQL.
3. **Viết migration script** `scripts/sql/YYYY_MM_DD_<desc>.sql`.
4. **Add vào `db4_schema.sql`** để fresh install vẫn dùng được.
5. **Add migration command vào `package.json`**:
   ```json
   "db:migrate:my-table": "node scripts/run-migration.mjs scripts/sql/2026_05_my_table.sql"
   ```
6. **Cập nhật `docs/db4.md`**: thêm bảng vào ERD + mô tả từng cột.
7. **Tạo model** trong `src/models/`.
8. **Commit**:
   ```
   feat(db): add <table_name> table

   - SQL migration với FK tới <parent>
   - Model JS với schema field mapping
   - Doc cập nhật trong db4.md
   ```

### Tránh

- ❌ Sửa trực tiếp DB qua psql / DBeaver mà không có migration file.
- ❌ Drop column production data — phải qua workflow: deprecate → migrate data → drop ở release sau.
- ❌ Đổi tên column production khi chưa thông báo BE/FE team.

### Convention DDL

```sql
CREATE TABLE IF NOT EXISTS my_table (
  my_table_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_my_table_foreign_key ON my_table (foreign_key);
```

- PK luôn là UUID `<tablename>_id`.
- FK tên `<parent>_id`.
- Mọi bảng có `created_at`, `updated_at` (nếu có update).
- Index cho mọi FK + cột thường lọc.
- Dùng `IF NOT EXISTS` để idempotent.

---

## 11. Testing

> Project hiện chưa có test framework. Sẽ thêm Jest / Vitest sau.

### Test thủ công bằng Swagger

1. Mở `http://localhost:3000/api-docs/`.
2. Authorize bằng JWT token.
3. Try out endpoint.
4. So sánh response với expected.

### Test thủ công bằng curl

```bash
# Login lấy token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"system.admin@warehouse.local","password":"Admin@12345"}' \
  | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>console.log(JSON.parse(s).data.token))")

# Gọi API
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/warehouses
```

### Test với REST Client (VS Code)

`tests/manual/auth.http`:

```http
### Login
# @name login
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "system.admin@warehouse.local",
  "password": "Admin@12345"
}

### Get me
GET http://localhost:3000/api/auth/me
Authorization: Bearer {{login.response.body.data.token}}
```

### Smoke test sau khi merge develop → main

```bash
# 1. Health
curl http://prod-host/api/health

# 2. Login
curl -X POST http://prod-host/api/auth/login -d '{...}'

# 3. List 1 endpoint mỗi domain chính
curl -H "Authorization: Bearer $T" http://prod-host/api/warehouses
curl -H "Authorization: Bearer $T" http://prod-host/api/tenants
curl -H "Authorization: Bearer $T" http://prod-host/api/inbound-requests
curl -H "Authorization: Bearer $T" http://prod-host/api/outbound-requests
```

---

## 12. Anti-patterns — cần tránh

### ❌ Controller gọi DB trực tiếp

```js
// SAI
export async function list(req, res) {
  const result = await pool.query('SELECT * FROM users');
  res.json(result.rows);
}
```

→ Tách ra service.

### ❌ String concat SQL

```js
// SAI — injection risk
const result = await pool.query(
  `SELECT * FROM users WHERE email = '${email}'`
);
```

→ Dùng parameterised:

```js
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);
```

### ❌ Trust body request

```js
// SAI — user có thể gửi { role: 'SYSTEM_ADMIN' }
await User.create(req.body);
```

→ `pickFields` trước:

```js
const data = pickFields(req.body, ['email', 'password', 'fullName']);
data.role = 'TENANT_STAFF'; // gán role server-side
await User.create(data);
```

### ❌ Throw `Error` thường

```js
// SAI — errorHandler không biết status code
throw new Error('Not found');
```

→ Dùng `AppError`:

```js
throw new AppError('Not found', 404, 'NOT_FOUND');
```

### ❌ N+1 query

```js
// SAI
const users = await User.findAll();
for (const u of users) {
  u.tenant = await TenantCompany.findById(u.tenantId);
}
```

→ JOIN hoặc batch fetch:

```js
const users = await User.findAll();
const tenantIds = [...new Set(users.map(u => u.tenantId))];
const tenants = await TenantCompany.findAll({ tenantId: tenantIds });
const tenantMap = new Map(tenants.map(t => [t.tenantId, t]));
users.forEach(u => { u.tenant = tenantMap.get(u.tenantId); });
```

### ❌ Trả về password_hash

```js
// SAI
res.json(user);
```

→ Strip nhạy cảm:

```js
import { toPublic } from '../utils/userPublic.js';
res.json(toPublic(user));
```

### ❌ `console.log` quên xoá

Tìm trước khi commit:

```bash
git diff --staged | grep -E '^\+.*console\.(log|error|debug)'
```

---

## 13. Security checklist

### Authentication

- [ ] JWT_SECRET ≥ 64 ký tự random, không commit vào repo.
- [ ] Token expire ≤ 7 ngày.
- [ ] Refresh token (sẽ thêm sau) — lưu DB, có thể revoke.
- [ ] Logout invalidate token (sẽ thêm sau).

### Authorization

- [ ] Mọi endpoint mutate (POST/PATCH/DELETE) phải có `authenticate`.
- [ ] Endpoint nhạy cảm có `authorize(...)`.
- [ ] Tenant không truy cập được data tenant khác (qua `req.user.tenantId` filter).
- [ ] WH_STAFF không xem được data warehouse khác.

### Input validation

- [ ] Tất cả UUID input đi qua `parseUuid`.
- [ ] Tất cả enum đi qua `assertEnum`.
- [ ] `pickFields` cho mọi body POST/PATCH.
- [ ] Không trust query string.

### SQL

- [ ] Không có string concat SQL.
- [ ] Mọi query qua `pool.query(text, params)`.

### Secrets

- [ ] `.env` trong `.gitignore`.
- [ ] `.env.example` không chứa secret thật.
- [ ] Không log JWT, password, OTP.
- [ ] Không log toàn bộ `req.body` nếu có password.

### Rate limiting (sẽ thêm)

- [ ] Login: 5 attempt / 5 phút.
- [ ] Change password: 3 attempt / 5 phút.
- [ ] OTP verify: 5 attempt / OTP (in-memory đã có).
- [ ] API chung: 100 req / phút / IP.

### CORS

- [ ] Production whitelist origin cụ thể, không `*`.
- [ ] Credentials = true chỉ cho origin tin cậy.

---

## 14. Performance tips

### Database

- Index cho mọi cột thường WHERE / JOIN.
- `LIMIT` mặc định 20, max 100.
- Pagination: dùng `OFFSET` cho UI nhỏ; dùng cursor-based khi list lớn.
- Avoid `SELECT *` khi chỉ cần vài cột — tách getter.

### Node

- Connection pool đã set ở `db.js`. Đừng tạo client mới mỗi request.
- Cache master data (categories, seasons) bằng in-memory Map có TTL nếu cần.
- Async parallel khi có thể:
  ```js
  // Thay vì
  const a = await fetchA();
  const b = await fetchB();
  
  // Dùng
  const [a, b] = await Promise.all([fetchA(), fetchB()]);
  ```

### Network

- Gzip response (`compression` middleware — sẽ thêm).
- HTTP keep-alive enabled.
- Image qua CDN (Cloudinary đã có).

---

## 15. FAQ cho thành viên mới

### Q1: Project có ESLint / Prettier chưa?

Hiện tại chỉ có Prettier mặc định của VS Code. ESLint sẽ thêm trong sprint tới. Tạm thời format tay theo style trong README.

### Q2: Tôi muốn add 1 lib mới, làm thế nào?

```bash
npm install <lib>
git add package.json package-lock.json
git commit -m "chore(deps): add <lib> for <reason>"
```

Trong PR description nêu rõ tại sao chọn lib này (so sánh 2-3 alternative nếu được).

### Q3: Có dùng TypeScript không?

Hiện tại không. Có plan migrate sau khi MVP ổn định. Lý do chưa dùng: tốc độ POC + team mixed level.

### Q4: Test framework nào?

Kế hoạch: **Vitest** (nhanh, ESM-native) + **Supertest** cho integration test. Sẽ setup ở milestone 2.

### Q5: Khi nào nên dùng PATCH vs PUT?

- `PATCH`: update 1 phần. Body chỉ chứa field cần đổi.
- `PUT`: replace toàn bộ resource. Hiếm khi dùng trong project này.

Tất cả endpoint update trong dự án đều là `PATCH`.

### Q6: Tôi muốn debug 1 query SQL chạy thế nào?

Đặt log trong service:

```js
console.log('[DEBUG]', filters);
const result = await Model.findAll(filters);
console.log('[DEBUG]', result.length, 'rows');
```

Hoặc thêm log trực tiếp vào `BaseModel.js` (tạm, đừng commit).

### Q7: Server start nhưng DB không kết nối được?

Check thứ tự:

1. Postgres có chạy không? (`netstat -ano | grep :5432`)
2. `.env` đúng `POSTGRES_*` chưa? Đặc biệt password có ký tự đặc biệt phải escape.
3. User `warehouse_admin` đã được tạo + grant chưa? Xem `init-scripts/`.
4. DB `smart_warehouse` đã tạo chưa? (`createdb smart_warehouse`)

### Q8: Email OTP gửi không tới?

- App password Gmail đã set đúng?
- 2FA Gmail đã bật?
- Check spam folder.
- Check log có `Mail sent: <messageId>` không.
- Test thử với Mailtrap để chắc chắn code đúng.

### Q9: Tôi sửa nhầm `db4_schema.sql` rồi commit. Làm sao?

Nếu chưa push:

```bash
git reset HEAD~1 scripts/sql/db4_schema.sql
git checkout -- scripts/sql/db4_schema.sql
git commit --amend
```

Nếu đã push:

```bash
git revert <hash>
git push
```

Rồi viết migration đúng cách.

### Q10: Branch develop của tôi cũ quá so với remote, conflict tùm lum?

```bash
git fetch origin
git checkout develop
git reset --hard origin/develop   # CẢNH BÁO: mất commit local của develop
git checkout feature/my-branch
git rebase develop
```

Nếu trên `feature/my-branch` có commit chưa push, backup branch trước:

```bash
git branch backup/my-branch
```

---

## Liên hệ

- Slack/Discord: kênh `#capstone-be`.
- Issue khẩn: tag `@lead-be` trên GitHub Issue.

---

> Cảm ơn bạn đã đọc tới đây! Đóng góp của bạn rất quan trọng cho team. 🎉
