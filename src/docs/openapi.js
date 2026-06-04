/**
 * OpenAPI 3.0 — Warehouse Structure APIs (Flow 2)
 * Served at GET /api-docs
 */

const uuid = { type: 'string', format: 'uuid' };

const errorResponse = {
  type: 'object',
  required: ['success', 'message', 'code'],
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string' },
    code: {
      type: 'string',
      enum: [
        'VALIDATION_ERROR',
        'NOT_FOUND',
        'DUPLICATE',
        'FK_VIOLATION',
        'INVALID_ID',
        'INTERNAL_ERROR',
        'DB_UNAVAILABLE',
        'NO_SLOT_CANDIDATE',
        'OLLAMA_UNAVAILABLE',
        'OLLAMA_DISABLED',
        'ALREADY_CLAIMED',
        'CLAIM_FAILED',
        'INVALID_STATUS_TRANSITION',
        'INVALID_INBOUND_STATUS',
        'RECEIVING_INCOMPLETE',
        'LPN_PUTAWAY_INCOMPLETE',
        'LPN_ALREADY_PUTAWAY',
        'INVALID_LPN_STATUS',
        'BIN_CAPACITY_EXCEEDED',
        'BIN_BLOCKED',
      ],
    },
    errors: { type: 'object', nullable: true },
  },
};

const paginationMeta = {
  type: 'object',
  properties: {
    page: { type: 'integer', example: 1 },
    limit: { type: 'integer', example: 20 },
    total: { type: 'integer', example: 42 },
    totalPages: { type: 'integer', example: 3 },
  },
};

function successEnvelope(dataSchema, description = 'Success') {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['success', 'message', 'data'],
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Success' },
            data: dataSchema,
          },
        },
      },
    },
  };
}

function paginatedEnvelope(itemSchema) {
  return {
    description: 'Paginated list',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['success', 'message', 'data', 'meta'],
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Success' },
            data: { type: 'array', items: itemSchema },
            meta: { $ref: '#/components/schemas/PaginationMeta' },
          },
        },
      },
    },
  };
}

const stdErrors = {
  400: {
    description: 'Validation error or bad request',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  401: {
    description: 'Unauthorized',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  403: {
    description: 'Forbidden',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  404: {
    description: 'Resource not found',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  409: {
    description: 'Conflict (duplicate key, rental request already claimed, etc.)',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
  503: {
    description: 'Service unavailable (e.g. Ollama not running)',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  },
};

const bearerSecurity = [{ bearerAuth: [] }];

const timestamps = {
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time', nullable: true },
};

// Synced with scripts/seed-locations.mjs so Swagger shows dropdowns.
const SEEDED_CITIES = ['TP.HCM', 'Hà Nội'];
const SEEDED_DISTRICTS = [
  'Quận 1',
  'Quận 2',
  'Quận 3',
  'Quận 4',
  'Quận 5',
  'Quận 6',
  'Quận 7',
  'Quận 8',
  'Quận 9',
  'Quận 10',
  'Quận 11',
  'Quận 12',
  'Bình Thạnh',
  'Bình Tân',
  'Gò Vấp',
  'Phú Nhuận',
  'Tân Bình',
  'Tân Phú',
  'Thủ Đức',
  'Hóc Môn',
  'Củ Chi',
  'Nhà Bè',
  'Cần Giờ',
  'Bình Chánh',
  'Ba Đình',
  'Hoàn Kiếm',
  'Tây Hồ',
  'Long Biên',
  'Cầu Giấy',
  'Đống Đa',
  'Hai Bà Trưng',
  'Hoàng Mai',
  'Thanh Xuân',
  'Hà Đông',
  'Nam Từ Liêm',
  'Bắc Từ Liêm',
  'Sơn Tây',
  'Ba Vì',
  'Phúc Thọ',
  'Đan Phượng',
  'Hoài Đức',
  'Quốc Oai',
  'Thạch Thất',
  'Chương Mỹ',
  'Thanh Oai',
  'Thường Tín',
  'Phú Xuyên',
  'Ứng Hòa',
  'Mỹ Đức',
  'Gia Lâm',
  'Đông Anh',
  'Sóc Sơn',
  'Mê Linh',
];

const spec = {
  openapi: '3.0.0',
  info: {
    title: 'Smart Warehouse API',
    version: '1.0.0',
    description:
      'NextGen Warehouse backend — đồng bộ với `docs/request.md`.\n\n' +
      '### Convention (mọi flow)\n' +
      '- Base: `/api`, body **camelCase**, cập nhật dùng **PATCH** (không PUT)\n' +
      '- GET list: `page` (default 1), `limit` (default 20, max 100)\n' +
      '- POST: ID cha trong **body**; GET list: ID cha/lọc trong **query**\n' +
      '- Field bắt buộc = danh sách `required` trong từng schema Request Body. Field không nằm trong `required` là optional.\n\n' +
      '### Role quick guide\n' +
      '- `SYSTEM_ADMIN`: quản trị hệ thống / user / warehouse master data\n' +
      '- `WH_ADMIN`, `WH_STAFF`, `WH_TRANSPORTER`: nghiệp vụ kho\n' +
      '- `TENANT_ADMIN`, `TENANT_STAFF`: nghiệp vụ tenant\n' +
      '- Endpoint public (guest) sẽ ghi rõ `security: []` trong Swagger\n\n' +
      '### Flow 1 — Tenant onboarding\n' +
      '**Guest (public)**\n' +
      '1. `POST /tenants` — tạo tenant company (`contactEmail` dùng tra cứu sau)\n' +
      '2. `POST /rental-requests` — `tenantId` + `city` + `district` (không `warehouseId`)\n' +
      '3. *(tuỳ chọn)* `GET /rental-requests/guest/lookup?code=RR-…&email=…` — tra cứu trạng thái\n\n' +
      '**WH_ADMIN** (Bearer)\n' +
      '4. `GET /warehouses/{warehouseId}/rental-requests?status=PENDING` — inbox cùng khu vực\n' +
      '5. `PATCH /rental-requests/{id}` — `status=APPROVED` + `warehouseId` (claim; kho nhanh nhất thắng)\n' +
      '6. `POST /users` — tạo `TENANT_ADMIN` gắn `tenantId` (welcome email)\n' +
      '7. `POST /contracts` — `tenantId`, `warehouseId`, `rentalRequestId` → thường `DRAFT` (có seed `contract-items`)\n' +
      '8. `POST /storage-reservations` — cấp bin/zone… `status=ACTIVE` *(bắt buộc trước khi tenant ký)*\n' +
      '9. `PATCH /contracts/{contractId}` — kho ký trước: `warehouseSignature` + `status=PENDING_APPROVAL`\n\n' +
      '**TENANT_ADMIN — ký & thanh toán → ACTIVE**\n' +
      '10. `POST /auth/login` — đăng nhập\n' +
      '11. `PATCH /contracts/{contractId}` — `{ tenantSignature }` → HĐ `PENDING_PAYMENT` + invoice **INITIAL** (kho phải đã ký + có storage ACTIVE)\n' +
      '12. `GET /contracts/{contractId}/invoices` — xem invoice đầu\n' +
      '13. `POST /contracts/{contractId}/invoices/{invoiceId}/payos/create-link` — PayOS → webhook ghi nhận đã trả\n' +
      '    - Dev/test: `POST …/invoices/{invoiceId}/mark-paid` (không qua PayOS)\n' +
      '14. Sau thanh toán INITIAL → HĐ **`ACTIVE`** (không set `status=ACTIVE` tay nếu invoice chưa PAID)\n\n' +
      '**Đóng onboarding (WH_ADMIN)**\n' +
      '15. `PATCH /tenants/{tenantId}` `{ status: ACTIVE }`\n' +
      '16. `PATCH /rental-requests/{id}` `{ status: CONVERTED }`\n\n' +
      'Trạng thái HĐ: `DRAFT` → `PENDING_APPROVAL` → `PENDING_PAYMENT` → **`ACTIVE`** → tenant tạo inbound được.\n\n' +
      '### Flow 2 — Warehouse structure\n' +
      'Warehouse → Zone → Rack → Rack Level → Bin\n\n' +
      '### Flow 3 — Inbound request (nhập kho)\n' +
      '**Tiền điều kiện:** HĐ **`ACTIVE`** (Flow 1); SKU master (`POST /skus`, catalog category/season/collection).\n\n' +
      '**TENANT_ADMIN / TENANT_STAFF**\n' +
      '1. `POST /inbound-requests` — `tenantId`, `contractId`, `warehouseId`, `deliveryMode` (`TENANT_SELF` mặc định | `WAREHOUSE_TRANSPORT`), `expectedArrivalDate`\n' +
      '2. `POST /inbound-requests/{id}/items` — dòng SKU (`skuId`, `expectedQuantity`); `PENDING` cần ≥1 dòng\n' +
      '3. `PATCH { "status": "PENDING" }` nếu tạo `DRAFT` · `GET …?includeItems=true` theo dõi\n' +
      '4a. **Tự vận chuyển:** `PUT …/delivery` (xe/tài xế) → `PATCH { "status": "ARRIVED", "actualArrivalAt": "…" }`\n' +
      '4b. **Kho vận chuyển:** `PUT …/delivery` (`pickupAddress`, liên hệ) — WH gán tài xế ở bước 6\n\n' +
      '**WH_ADMIN / WH_STAFF**\n' +
      '5. `GET /inbound-requests/{id}/approval-readiness` — kiểm capacity / LPN ước tính trước duyệt\n' +
      '6. `PATCH { "status": "APPROVED" }` — duyệt (`approvedBy` từ token); kiểm trần cam kết HĐ\n' +
      '7. *(WAREHOUSE_TRANSPORT)* `PUT …/delivery` — `assignedDriverUserId` (WH_TRANSPORTER)\n\n' +
      '**WH_TRANSPORTER** (chỉ `WAREHOUSE_TRANSPORT`)\n' +
      '8. `POST …/report-arrival` từ `APPROVED` → **`ARRIVED`** (+ `actualArrivalAt`)\n\n' +
      '**WH_STAFF — receiving & putaway**\n' +
      '9. `POST …/start-receiving` — `ARRIVED` → **`RECEIVING`**\n' +
      '10. Ghi nhận số thực nhận: `PATCH /inbound-request-items/{id}` `receivedQuantity` hoặc `POST …/complete-receiving` + `items[]`\n' +
      '11. `POST /batches` — `{ inboundRequestId, batchCode }` (FIFO `warehouseReceivedAt`)\n' +
      '12. `POST /lpns` + `POST /lpn-details` — thùng `RECEIVING`, đóng SKU vào LPN\n' +
      '13. Putaway: **Flow 5** (`POST /ai/slot-recommendations` → `POST /lpns/{id}/putaway`) hoặc `POST …/bulk-putaway` / `…/auto-putaway`\n' +
      '14. `POST …/complete` — mọi LPN **`STORED`**, có ≥1 batch → inbound **`COMPLETED`** (mở tồn / outbound Flow 4)\n\n' +
      '**State machine:** `DRAFT` → `PENDING` → `APPROVED` → `ARRIVED` → `RECEIVING` → **`COMPLETED`** · `CANCELLED` (tenant: trước nhận; WH: có rule khi đã duyệt)\n\n' +
      '**Master data (cùng flow):** `GET/POST /categories`, `/seasons`, `/collections`, `/skus` · `GET /warehouses/{id}/inbound-requests`\n\n' +
      '### Flow 4 — Outbound request (xuất kho)\n' +
      '**Tiền điều kiện:** HĐ **`ACTIVE`** (invoice INITIAL đã PAID) hoặc `TERMINATED` (xuất hết hàng); đã có SKU + ≥1 inbound **`COMPLETED`**; tồn `available_quantity > 0` (`GET /inventories?tenantId=&warehouseId=`).\n\n' +
      '**TENANT_ADMIN / TENANT_STAFF**\n' +
      '1. `POST /outbound-requests` — `tenantId`, `contractId`, `warehouseId`, `items[]` (`skuId`, `requestedQuantity`); mặc định `status=PENDING` (hoặc `DRAFT` rồi gửi sau)\n' +
      '2. *(tuỳ chọn)* `POST /outbound-requests/{id}/items` hoặc `POST /outbound-request-items` — thêm/sửa dòng khi `DRAFT`/`PENDING`\n' +
      '3. `GET /outbound-requests` · `GET /outbound-requests/{id}?includeItems=true` — theo dõi phiếu\n' +
      '4. Hủy (tenant): `PATCH { "status": "CANCELLED" }` chỉ khi `DRAFT`/`PENDING`\n\n' +
      '**WH_ADMIN / WH_STAFF**\n' +
      '5. `PATCH /outbound-requests/{id}` `{ "status": "APPROVED" }` từ `PENDING` → duyệt + **reserve FIFO** + tạo picking task → phiếu **`RESERVED`** (một bước, không dừng ở `APPROVED`)\n' +
      '   - Recovery: nếu kẹt `APPROVED`: `PATCH { "status": "RESERVED" }`\n' +
      '6. `GET /outbound-requests/{id}/picking-tasks` — xem task + dòng pick (LPN, bin, batch, `quantityToPick`)\n' +
      '7. `PATCH { "status": "PICKING" }` — bắt đầu pick (mobile/scan: `POST /scan/resolve` với mã `OUT-…`)\n' +
      '8. `PATCH { "status": "PACKING" }` — xác nhận đã pick đủ (`picked_quantity` = `quantity_to_pick`)\n' +
      '9. `PATCH { "status": "SHIPPED" }` — trừ tồn + `inventory_movements` type `OUTBOUND`, gán `actualShippedAt`\n' +
      '10. *(tuỳ chọn)* `PATCH { "status": "COMPLETED" }` từ `SHIPPED` · `POST/GET /shipments` — vận chuyển/đóng phiếu\n' +
      '11. Hủy (WH): `CANCELLED` trước `SHIPPED` — giải phóng reserve nếu đã `RESERVED`+\n\n' +
      '**State machine:** `DRAFT` → `PENDING` → (`APPROVED` nội bộ) → **`RESERVED`** → `PICKING` → `PACKING` → **`SHIPPED`** → `COMPLETED` · `CANCELLED`\n\n' +
      '### Flow 5 — AI slot recommendation (putaway)\n' +
      '**Tiền điều kiện (sau Flow 3 receiving):** LPN `RECEIVING`, có `POST /lpn-details`, `warehouseId` inbound; nên có `weightKg` (rack-suggestion). **Rule engine** chọn bin (`slotting-v1-rule`); **LLM** (Gemini/Ollama) chỉ **giải thích** — không đổi bin.\n\n' +
      '**WH_ADMIN / WH_STAFF**\n' +
      '1. *(tuỳ chọn)* `GET /ai/slot-recommendations/ollama/health` · `GET …/gemini/health` — kiểm LLM trước explain\n' +
      '2. *(tuỳ chọn)* `GET /lpns/{lpnId}/rack-suggestion?warehouseId=` — gợi ý `rackType` theo cân nặng (STANDARD / HIGH_CAPACITY)\n' +
      '3. `POST /ai/slot-recommendations/preview` — `{ lpnId, warehouseId, inboundRequestId? }` → top bin + `alternatives[]` + `score`/`reasons` (**không lưu DB**, không LLM)\n' +
      '4. *(tuỳ chọn)* `POST /ai/slot-recommendations/explain` — `{ llmProvider: "gemini"|"ollama", … }` giải thích tiếng Việt (từ preview, `recommendationId`, hoặc `lpnId`+`warehouseId`)\n' +
      '5. `POST /ai/slot-recommendations` — lưu bản ghi `ai_slot_recommendations` (`isApplied=false`)\n' +
      '6. `POST /lpns/{lpnId}/putaway` — `{ binId, recommendationId? }` → tồn + movement `PUTAWAY`; tự `isApplied=true` nếu bin = AI gợi ý\n' +
      '7. `PATCH /ai/slot-recommendations/{id}` `{ "isApplied": true }` — đánh dấu tay nếu staff chọn bin khác\n' +
      '8. `GET /ai/slot-recommendations?lpnId=&inboundRequestId=&isApplied=` — lịch sử / audit\n\n' +
      '**Lưu ý:** Không gửi `explainWithLlm` trên preview/create (→ `400 USE_EXPLAIN_ENDPOINT`). AI **không** allocate outbound (Flow 4 dùng FIFO). Putaway hàng loạt theo HĐ: `POST /inbound-requests/{id}/auto-putaway` (rule reservation, khác AI scoring).\n\n' +
      '### Authentication\n' +
      '- `POST /api/auth/login` — public\n' +
      '- `POST /api/auth/forgot-password` + `/verify` — public (OTP flow)\n' +
      '- `POST /api/auth/change-password` — Bearer token (đổi mật khẩu khi đã đăng nhập)\n' +
      '- `POST /api/auth/reset-password` — public (welcome email token)\n' +
      '- `/api/users/*` — Bearer token; SYSTEM_ADMIN → WH_ADMIN/TENANT_ADMIN; WH_ADMIN → WH_STAFF; TENANT_ADMIN → TENANT_STAFF\n' +
      '- `POST /tenants`, `POST /rental-requests`, `GET /rental-requests/guest/lookup` — public (guest onboarding)',
  },
  servers: [
    {
      url: 'http://127.0.0.1:3000',
      description: 'Local development (Windows: không dùng localhost:3000)',
    },
  ],
  // Default: mọi API dùng Bearer token trong Swagger (Authorize).
  security: bearerSecurity,
  tags: [
    {
      name: 'System',
      description: 'Health check · Roles: public (không cần token)',
    },
    {
      name: 'Auth',
      description:
        'Login, quên/đổi mật khẩu · Roles: public (login/forgot); đổi MK: mọi user đã đăng nhập',
    },
    {
      name: 'User',
      description:
        'Quản lý tài khoản · Roles: `SYSTEM_ADMIN`, `WH_ADMIN`, `TENANT_ADMIN` (CRUD theo scope). `GET/PATCH /users/me`: mọi role',
    },
    {
      name: 'Warehouse',
      description:
        'Kho vật lý · Roles: `SYSTEM_ADMIN` (CRUD); `WH_ADMIN` (sửa kho mình); đọc: `WH_STAFF`, `WH_TRANSPORTER`, `TENANT_ADMIN`, `TENANT_STAFF` (theo hợp đồng/scope)',
    },
    {
      name: 'Zone',
      description:
        'Vùng kho · Roles: `SYSTEM_ADMIN`, `WH_ADMIN` (CRUD); `WH_STAFF` (GET — lập kế hoạch putaway)',
    },
    {
      name: 'Rack',
      description:
        'Kệ · Roles: `SYSTEM_ADMIN`, `WH_ADMIN` (CRUD); `WH_STAFF` (GET — putaway). Bearer khuyến nghị',
    },
    {
      name: 'RackLevel',
      description:
        'Tầng kệ · Roles: `SYSTEM_ADMIN`, `WH_ADMIN` (CRUD); `WH_STAFF` (GET — putaway). Bearer khuyến nghị',
    },
    {
      name: 'Bin',
      description:
        'Ô lưu · Roles: `SYSTEM_ADMIN`, `WH_ADMIN` (CRUD); `WH_STAFF` (GET — putaway). Bearer khuyến nghị',
    },
    {
      name: 'Category',
      description:
        'Danh mục hàng (master) · Roles: đọc: mọi user có token; sửa: `TENANT_ADMIN` (tenant scope)',
    },
    {
      name: 'Season',
      description:
        'Mùa (master) · Roles: đọc: mọi user có token; sửa: `TENANT_ADMIN` (tenant scope)',
    },
    {
      name: 'Collection',
      description:
        'Bộ sưu tập (master) · Roles: đọc: mọi user có token; sửa: `TENANT_ADMIN` (tenant scope)',
    },
    {
      name: 'SKU',
      description:
        'Mã SKU tenant (Flow 3 tiền điều kiện) · Tạo trước inbound items. Roles: `TENANT_ADMIN`, `TENANT_STAFF` (CRUD); WH/System xem.',
    },
    {
      name: 'InboundRequest',
      description:
        'Yêu cầu nhập kho (Flow 3) · Tenant tạo + dòng SKU; WH duyệt/receive/complete; transporter `report-arrival`. Putaway → Flow 5. Xem **Flow 3** đầu API docs.',
    },
    {
      name: 'InboundRequestItem',
      description:
        'Dòng SKU inbound (Flow 3 bước 2, 10) · `expectedQuantity` / `receivedQuantity`; thêm khi `DRAFT`/`PENDING`; đếm khi `RECEIVING`.',
    },
    {
      name: 'Inventory',
      description:
        'Tồn kho (SKU + batch + LPN + bin) · Flow 4 tiền điều kiện: `available_quantity > 0`. Roles: xem — `SYSTEM_ADMIN` (all); `WH_ADMIN`, `WH_STAFF` (`warehouseId`); `TENANT_ADMIN`, `TENANT_STAFF` (`tenantId`). GET only',
    },
    {
      name: 'OutboundRequest',
      description:
        'Yêu cầu xuất kho (Flow 4) · Tenant: `POST` phiếu + dòng SKU. WH: `PATCH` workflow (`APPROVED`→`RESERVED`→`PICKING`→`PACKING`→`SHIPPED`). `GET …/picking-tasks` sau duyệt. `approvedBy`/`createdBy` từ Bearer — xem mô tả **Flow 4** đầu trang API docs.',
    },
    {
      name: 'OutboundRequestItem',
      description:
        'Dòng SKU trên outbound (Flow 4 bước 2) · `skuId` + `requestedQuantity`; chỉ sửa khi phiếu `DRAFT`/`PENDING`; BE kiểm `INSUFFICIENT_INVENTORY` khi duyệt/reserve',
    },
    {
      name: 'Batch',
      description:
        'Lô nhận hàng (Flow 3 bước 11) · Gắn `inboundRequestId`; timestamp FIFO. Roles: `WH_ADMIN`, `WH_STAFF`.',
    },
    {
      name: 'LPN',
      description:
        'Carton/pallet (Flow 3 + **Flow 5**) · `rack-suggestion`, `POST …/putaway`, AI slot API. Roles: `WH_ADMIN`, `WH_STAFF`.',
    },
    {
      name: 'LPNDetail',
      description:
        'SKU trong LPN · Roles: `WH_ADMIN`, `WH_STAFF`. Bearer khuyến nghị',
    },
    {
      name: 'AI',
      description:
        'Flow 5 — Gợi ý bin putaway: rule engine (`preview`/`POST`) + LLM explain (`gemini`|`ollama`). Roles: `WH_ADMIN`, `WH_STAFF`. Putaway thực tế: `POST /lpns/{id}/putaway`. Xem **Flow 5** đầu API docs.',
    },
    {
      name: 'RentalRequest',
      description:
        'Yêu cầu thuê kho (Flow 1) · Roles: `POST` public/guest + tenant; list/GET: `TENANT_ADMIN`, `TENANT_STAFF` (own), `WH_ADMIN`, `SYSTEM_ADMIN`; duyệt/claim: `WH_ADMIN`, `SYSTEM_ADMIN`',
    },
    {
      name: 'TenantCompany',
      description:
        'Công ty tenant (onboarding) · Roles: `POST` public; đọc/sửa: `TENANT_ADMIN` (own), `WH_ADMIN`/`SYSTEM_ADMIN` (view)',
    },
    {
      name: 'Contract',
      description:
        'Hợp đồng thuê (Flow 1) · WH: tạo/ký trước + cấp storage; tenant: ký → `PENDING_PAYMENT`; thanh toán invoice INITIAL → `ACTIVE` (xem tag **PayOS**). **Chấm dứt sớm:** `GET/POST …/termination/*` — doc `contract-billing-termination.md`',
    },
    {
      name: 'ContractAppendix',
      description:
        'Yêu cầu phụ lục: **TENANT_ADMIN** gửi → **WH_ADMIN** duyệt/từ chối → tenant ký → thanh toán → `ACTIVE`. Vượt trần cấp → `APPENDIX_NEED_NEW_CONTRACT`. Doc: `docs/contract-appendix.md`',
    },
    {
      name: 'PayOS',
      description:
        'Thanh toán invoice (Flow 1 bước 13–14) · `TENANT_ADMIN`: `POST …/invoices/{invoiceId}/payos/create-link` khi HĐ `PENDING_PAYMENT`. Webhook PayOS → `mark-paid` nội bộ → HĐ `ACTIVE`. Dev: `POST …/mark-paid`',
    },
    {
      name: 'ContractItem',
      description:
        'Dòng hợp đồng · Roles: `WH_ADMIN`, `SYSTEM_ADMIN` (quản lý); tenant xem theo contract',
    },
    {
      name: 'StorageReservation',
      description:
        'Giữ chỗ lưu trữ (bin/zone) · Roles: `WH_ADMIN`, `SYSTEM_ADMIN` (cấp phát); tenant xem',
    },
    {
      name: 'Scan',
      description:
        'Mobile scan Code128 (Flow 4 bước 7) · Roles: `WH_ADMIN`, `WH_STAFF`, `WH_TRANSPORTER`, `SYSTEM_ADMIN`. Resolve `OUT-*` outbound, `INB-*`, LPN, SKU, bin, batch',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ErrorResponse: errorResponse,
      PaginationMeta: paginationMeta,

      BarcodeScanResult: {
        type: 'object',
        description:
          'Kết quả quét Code128. Mobile in tem = field `value`; sau quét gọi resolve với cùng chuỗi.',
        properties: {
          symbology: { type: 'string', example: 'CODE128' },
          value: {
            type: 'string',
            example: 'INB-M2K3F-01',
            description: 'Nội dung mã Code128 (business code)',
          },
          structuredValue: {
            type: 'string',
            example: 'NGW1|INBOUND|INB-M2K3F-01',
            description: 'Payload có cấu trúc (tùy chọn khi in tem)',
          },
          entityType: {
            type: 'string',
            enum: [
              'INBOUND_REQUEST',
              'OUTBOUND_REQUEST',
              'LPN',
              'SKU',
              'BIN',
              'BATCH',
            ],
          },
          entityId: { ...uuid, nullable: true },
          displayCode: { type: 'string', nullable: true },
          scanFormat: { type: 'string', enum: ['BUSINESS_CODE', 'NGW1'] },
          scannedRaw: { type: 'string' },
          entity: {
            type: 'object',
            description:
              'Bản ghi theo entityType. **BATCH**: batch + `inbound` (code, status) + `lpns[]` + `lpnCount` — batch không có status riêng; tiến độ trên từng LPN (`RECEIVING`/`STORED`/…).',
          },
        },
      },

      Warehouse: {
        type: 'object',
        properties: {
          warehouseId: uuid,
          warehouseCode: { type: 'string', example: 'WH-HCM-01' },
          warehouseName: { type: 'string', example: 'Kho HCM Trung tâm' },
          address: { type: 'string', nullable: true },
          city: { type: 'string', nullable: true, example: 'TP.HCM' },
          district: { type: 'string', nullable: true, example: 'Quận 7' },
          totalAreaM2: { type: 'number', nullable: true },
          usableAreaM2: { type: 'number', nullable: true },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'CLOSED'],
          },
          ...timestamps,
        },
      },
      WarehouseCreate: {
        type: 'object',
        required: ['warehouseCode', 'warehouseName'],
        description:
          '`city` và `district` dùng match rental request theo khu vực (Flow 1 inbox).',
        properties: {
          warehouseCode: { type: 'string' },
          warehouseName: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string', example: 'TP.HCM' },
          district: { type: 'string', example: 'Quận 7' },
          totalAreaM2: { type: 'number' },
          usableAreaM2: { type: 'number' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'CLOSED'],
            default: 'ACTIVE',
          },
        },
      },
      WarehouseUpdate: {
        type: 'object',
        properties: {
          warehouseName: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string', example: 'TP.HCM' },
          district: { type: 'string', example: 'Quận 7' },
          totalAreaM2: { type: 'number' },
          usableAreaM2: { type: 'number' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'CLOSED'],
          },
        },
      },

      WarehouseZone: {
        type: 'object',
        properties: {
          zoneId: uuid,
          warehouseId: uuid,
          zoneCode: { type: 'string', example: 'Z-A01' },
          zoneName: { type: 'string', nullable: true },
          zoneType: {
            type: 'string',
            enum: ['SHARED', 'FAST_MOVING', 'PREMIUM', 'PRIVATE'],
          },
          areaM2: { type: 'number', nullable: true },
          isDedicated: { type: 'boolean' },
          status: { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
          ...timestamps,
        },
      },
      ZoneCreate: {
        type: 'object',
        required: ['warehouseId', 'zoneCode'],
        properties: {
          warehouseId: uuid,
          zoneCode: { type: 'string' },
          zoneName: { type: 'string' },
          zoneType: {
            type: 'string',
            enum: ['SHARED', 'FAST_MOVING', 'PREMIUM', 'PRIVATE'],
            default: 'SHARED',
          },
          areaM2: { type: 'number' },
          isDedicated: { type: 'boolean', default: false },
          status: { type: 'string', enum: ['ACTIVE', 'BLOCKED'], default: 'ACTIVE' },
        },
      },
      ZoneUpdate: {
        type: 'object',
        properties: {
          zoneName: { type: 'string' },
          zoneType: {
            type: 'string',
            enum: ['SHARED', 'FAST_MOVING', 'PREMIUM', 'PRIVATE'],
          },
          areaM2: { type: 'number' },
          isDedicated: { type: 'boolean' },
          status: { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
        },
      },

      Rack: {
        type: 'object',
        properties: {
          rackId: uuid,
          zoneId: uuid,
          rackCode: { type: 'string', example: 'R-A01-01' },
          rackType: { type: 'string', enum: ['STANDARD'] },
          maxLevels: { type: 'integer', nullable: true },
          status: { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
          ...timestamps,
        },
      },
      RackCreate: {
        type: 'object',
        required: ['zoneId', 'rackCode'],
        properties: {
          zoneId: uuid,
          rackCode: { type: 'string' },
          rackType: {
            type: 'string',
            enum: ['STANDARD'],
            default: 'STANDARD',
          },
          maxLevels: { type: 'integer', minimum: 1 },
          status: { type: 'string', enum: ['ACTIVE', 'BLOCKED'], default: 'ACTIVE' },
        },
      },
      RackUpdate: {
        type: 'object',
        properties: {
          rackType: { type: 'string', enum: ['STANDARD'] },
          maxLevels: { type: 'integer', minimum: 1 },
          status: { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
        },
      },

      RackLevel: {
        type: 'object',
        properties: {
          rackLevelId: uuid,
          rackId: uuid,
          levelCode: { type: 'string', nullable: true },
          levelNumber: { type: 'integer', example: 1 },
          maxBins: { type: 'integer', nullable: true },
          maxWeightKg: { type: 'number', nullable: true },
          heightCm: { type: 'number', nullable: true },
          levelPriority: { type: 'integer', nullable: true },
          ...timestamps,
        },
      },
      RackLevelCreate: {
        type: 'object',
        required: ['rackId', 'levelNumber'],
        properties: {
          rackId: uuid,
          levelCode: { type: 'string' },
          levelNumber: { type: 'integer', minimum: 1 },
          maxBins: { type: 'integer', minimum: 0 },
          maxWeightKg: { type: 'number', minimum: 0 },
          heightCm: { type: 'number', minimum: 0 },
          levelPriority: { type: 'integer', minimum: 0 },
        },
      },
      RackLevelUpdate: {
        type: 'object',
        properties: {
          levelCode: { type: 'string' },
          maxBins: { type: 'integer', minimum: 0 },
          maxWeightKg: { type: 'number', minimum: 0 },
          heightCm: { type: 'number', minimum: 0 },
          levelPriority: { type: 'integer', minimum: 0 },
        },
      },

      Bin: {
        type: 'object',
        properties: {
          binId: uuid,
          rackLevelId: uuid,
          binCode: { type: 'string', example: 'B-A01-L1-01' },
          supportedBoxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
            nullable: true,
          },
          maxLpnCount: { type: 'integer' },
          currentLpnCount: { type: 'integer', default: 0 },
          maxVolumeUnits: { type: 'integer' },
          usedVolumeUnits: { type: 'integer', default: 0 },
          maxOwnerCount: { type: 'integer', default: 3 },
          reservationType: {
            type: 'string',
            enum: ['SHARED', 'RESERVED', 'DEDICATED'],
          },
          status: {
            type: 'string',
            enum: ['EMPTY', 'PARTIAL', 'FULL', 'RESERVED', 'BLOCKED'],
          },
          ...timestamps,
        },
      },
      BinCreate: {
        type: 'object',
        required: ['rackLevelId', 'binCode', 'maxLpnCount', 'maxVolumeUnits'],
        properties: {
          rackLevelId: uuid,
          binCode: { type: 'string' },
          supportedBoxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          maxLpnCount: { type: 'integer', minimum: 1 },
          maxVolumeUnits: { type: 'integer', minimum: 1 },
          maxOwnerCount: { type: 'integer', minimum: 1, default: 3 },
          reservationType: {
            type: 'string',
            enum: ['SHARED', 'RESERVED', 'DEDICATED'],
            default: 'SHARED',
          },
          status: {
            type: 'string',
            enum: ['EMPTY', 'PARTIAL', 'FULL', 'RESERVED', 'BLOCKED'],
            default: 'EMPTY',
          },
        },
      },
      BinUpdate: {
        type: 'object',
        properties: {
          supportedBoxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          maxLpnCount: { type: 'integer', minimum: 1 },
          maxVolumeUnits: { type: 'integer', minimum: 1 },
          maxOwnerCount: { type: 'integer', minimum: 1 },
          reservationType: {
            type: 'string',
            enum: ['SHARED', 'RESERVED', 'DEDICATED'],
          },
          status: {
            type: 'string',
            enum: ['EMPTY', 'PARTIAL', 'FULL', 'RESERVED', 'BLOCKED'],
          },
        },
      },

      Category: {
        type: 'object',
        properties: {
          categoryId: uuid,
          categoryName: { type: 'string', example: 'Áo' },
        },
      },
      CategoryCreate: {
        type: 'object',
        required: ['categoryName'],
        properties: {
          categoryName: { type: 'string', example: 'Quần' },
        },
      },
      CategoryUpdate: {
        type: 'object',
        properties: {
          categoryName: { type: 'string' },
        },
      },

      Season: {
        type: 'object',
        properties: {
          seasonId: uuid,
          seasonName: { type: 'string', example: 'Xuân 2026' },
        },
      },
      SeasonCreate: {
        type: 'object',
        required: ['seasonName'],
        properties: {
          seasonName: { type: 'string', example: 'Hè 2026' },
        },
      },
      SeasonUpdate: {
        type: 'object',
        properties: {
          seasonName: { type: 'string' },
        },
      },

      Collection: {
        type: 'object',
        properties: {
          collectionId: uuid,
          tenantId: uuid,
          collectionName: { type: 'string', example: 'Dòng cơ bản' },
        },
      },
      CollectionCreate: {
        type: 'object',
        required: ['tenantId', 'collectionName'],
        properties: {
          tenantId: uuid,
          collectionName: { type: 'string', example: 'Công sở' },
        },
      },
      CollectionUpdate: {
        type: 'object',
        properties: {
          collectionName: { type: 'string' },
        },
      },

      Sku: {
        type: 'object',
        properties: {
          skuId: uuid,
          tenantId: uuid,
          skuCode: { type: 'string', example: 'SKU-TSHIRT-BLK-M' },
          productName: { type: 'string' },
          categoryId: { ...uuid, nullable: true },
          collectionId: { ...uuid, nullable: true },
          seasonId: { ...uuid, nullable: true },
          color: { type: 'string', nullable: true },
          size: { type: 'string', nullable: true },
          material: { type: 'string', nullable: true },
          movementCategory: {
            type: 'string',
            enum: ['FAST', 'NORMAL', 'SLOW'],
          },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
          ...timestamps,
        },
      },
      SkuCreate: {
        type: 'object',
        required: ['tenantId', 'skuCode', 'productName'],
        properties: {
          tenantId: uuid,
          skuCode: { type: 'string' },
          productName: { type: 'string' },
          categoryId: uuid,
          collectionId: uuid,
          seasonId: uuid,
          color: { type: 'string' },
          size: { type: 'string' },
          material: { type: 'string' },
          movementCategory: {
            type: 'string',
            enum: ['FAST', 'NORMAL', 'SLOW'],
            default: 'NORMAL',
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE'],
            default: 'ACTIVE',
          },
        },
      },
      SkuUpdate: {
        type: 'object',
        properties: {
          skuCode: { type: 'string' },
          productName: { type: 'string' },
          categoryId: { ...uuid, nullable: true },
          collectionId: { ...uuid, nullable: true },
          seasonId: { ...uuid, nullable: true },
          color: { type: 'string', nullable: true },
          size: { type: 'string', nullable: true },
          material: { type: 'string', nullable: true },
          movementCategory: {
            type: 'string',
            enum: ['FAST', 'NORMAL', 'SLOW'],
          },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
        },
      },

      Batch: {
        type: 'object',
        properties: {
          batchId: uuid,
          inboundRequestId: uuid,
          batchCode: { type: 'string', example: 'BATCH-2026-0001' },
          warehouseReceivedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      BatchCreate: {
        type: 'object',
        required: ['inboundRequestId', 'batchCode'],
        properties: {
          inboundRequestId: uuid,
          batchCode: { type: 'string' },
          warehouseReceivedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Defaults to server time if omitted',
          },
        },
      },
      BatchUpdate: {
        type: 'object',
        properties: {
          batchCode: { type: 'string' },
          warehouseReceivedAt: { type: 'string', format: 'date-time' },
        },
      },

      InboundRequest: {
        type: 'object',
        properties: {
          inboundRequestId: uuid,
          tenantId: uuid,
          contractId: uuid,
          warehouseId: uuid,
          inboundCode: { type: 'string', example: 'INB-LX1A2B-0C' },
          expectedArrivalDate: { type: 'string', format: 'date-time', nullable: true },
          actualArrivalAt: { type: 'string', format: 'date-time', nullable: true },
          status: {
            type: 'string',
            enum: [
              'DRAFT',
              'PENDING',
              'APPROVED',
              'ARRIVED',
              'RECEIVING',
              'COMPLETED',
              'CANCELLED',
            ],
          },
          createdBy: { ...uuid, nullable: true },
          approvedBy: { ...uuid, nullable: true },
          receivedBy: { ...uuid, nullable: true },
          deliveryMode: {
            type: 'string',
            enum: ['TENANT_SELF', 'WAREHOUSE_TRANSPORT'],
            description: 'TENANT_SELF: tenant báo ARRIVED. WAREHOUSE_TRANSPORT: transporter report-arrival.',
          },
          ...timestamps,
        },
      },
      InboundRequestCreate: {
        type: 'object',
        description:
          '**Flow 3 bước 1.** Required: `tenantId`, `contractId`, `warehouseId`. HĐ ACTIVE. `WH_ADMIN` không được POST. Actor fields nên để server set từ token.',
        required: ['tenantId', 'contractId', 'warehouseId'],
        example: {
          tenantId: '98cad623-9071-4f40-8f41-196940a9338d',
          contractId: 'a5f86099-adcf-4151-8c90-884d16b9e6e2',
          warehouseId: 'f2af9626-635b-4fe2-a149-3ab5b33b153e',
          expectedArrivalDate: '2026-06-15T09:00:00.000Z',
        },
        properties: {
          tenantId: uuid,
          contractId: uuid,
          warehouseId: uuid,
          deliveryMode: {
            type: 'string',
            enum: ['TENANT_SELF', 'WAREHOUSE_TRANSPORT'],
            default: 'TENANT_SELF',
          },
          expectedArrivalDate: { type: 'string', format: 'date-time' },
          actualArrivalAt: { type: 'string', format: 'date-time' },
          status: {
            type: 'string',
            enum: [
              'DRAFT',
              'PENDING',
              'APPROVED',
              'ARRIVED',
              'RECEIVING',
              'COMPLETED',
              'CANCELLED',
            ],
            default: 'PENDING',
          },
          createdBy: uuid,
          approvedBy: uuid,
          receivedBy: uuid,
        },
      },
      InboundRequestUpdate: {
        type: 'object',
        description:
          'Flow 3 — `status` workflow; `deliveryMode`; dates. `WAREHOUSE_TRANSPORT`: không PATCH `ARRIVED` (dùng `POST …/report-arrival`).',
        properties: {
          deliveryMode: {
            type: 'string',
            enum: ['TENANT_SELF', 'WAREHOUSE_TRANSPORT'],
          },
          expectedArrivalDate: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          actualArrivalAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          status: {
            type: 'string',
            enum: [
              'DRAFT',
              'PENDING',
              'APPROVED',
              'ARRIVED',
              'RECEIVING',
              'COMPLETED',
              'CANCELLED',
            ],
          },
          approvedBy: { ...uuid, nullable: true },
          receivedBy: { ...uuid, nullable: true },
        },
      },
      InboundRequestWithItems: {
        allOf: [
          { $ref: '#/components/schemas/InboundRequest' },
          {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/InboundRequestItem' },
              },
            },
          },
        ],
      },
      InboundRequestItem: {
        type: 'object',
        properties: {
          inboundRequestItemId: uuid,
          inboundRequestId: uuid,
          skuId: uuid,
          expectedQuantity: { type: 'integer', minimum: 1 },
          receivedQuantity: { type: 'integer', minimum: 0, default: 0 },
          discrepancyQuantity: { type: 'integer', default: 0 },
          createdAt: { type: 'string', format: 'date-time' },
          sku: {
            type: 'object',
            properties: {
              skuId: uuid,
              skuCode: { type: 'string' },
              productName: { type: 'string' },
              color: { type: 'string', nullable: true },
              size: { type: 'string', nullable: true },
            },
          },
        },
      },
      InboundRequestItemCreate: {
        type: 'object',
        required: ['skuId', 'expectedQuantity'],
        properties: {
          inboundRequestId: {
            ...uuid,
            description: 'Required on POST /inbound-request-items; omitted when nested under inbound',
          },
          skuId: uuid,
          expectedQuantity: { type: 'integer', minimum: 1 },
        },
      },
      InboundRequestItemUpdate: {
        type: 'object',
        properties: {
          expectedQuantity: { type: 'integer', minimum: 1 },
          receivedQuantity: { type: 'integer', minimum: 0 },
          discrepancyQuantity: { type: 'integer', minimum: 0 },
        },
      },
      InboundStartReceiving: {
        type: 'object',
        properties: {
          receivedBy: uuid,
        },
      },
      InboundCompleteReceiving: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['inboundRequestItemId', 'receivedQuantity'],
              properties: {
                inboundRequestItemId: uuid,
                receivedQuantity: { type: 'integer', minimum: 0 },
              },
            },
            description:
              'Optional if every line already has receivedQuantity via PATCH; otherwise required',
          },
        },
      },
      InboundCompleteReceivingResult: {
        type: 'object',
        properties: {
          inboundRequestId: uuid,
          status: { type: 'string', example: 'RECEIVING' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/InboundRequestItem' },
          },
          message: { type: 'string' },
        },
      },
      LpnPutawayRequest: {
        type: 'object',
        required: ['binId'],
        properties: {
          binId: uuid,
          recommendationId: {
            ...uuid,
            description: 'Optional ai_slot_recommendations id to mark isApplied',
          },
          movedBy: uuid,
        },
      },
      LpnPutawayResult: {
        type: 'object',
        properties: {
          lpn: { $ref: '#/components/schemas/LpnWithDetails' },
          inboundRequestId: uuid,
          inboundStatus: { type: 'string' },
        },
      },
      Inventory: {
        type: 'object',
        properties: {
          inventoryId: uuid,
          tenantId: uuid,
          skuId: uuid,
          batchId: uuid,
          lpnId: uuid,
          binId: uuid,
          quantity: { type: 'integer' },
          reservedQuantity: { type: 'integer' },
          availableQuantity: { type: 'integer' },
          status: {
            type: 'string',
            enum: ['AVAILABLE', 'RESERVED', 'PICKED', 'DAMAGED', 'IN_TRANSIT', 'SHIPPED'],
          },
          receivedAt: { type: 'string', format: 'date-time', nullable: true },
          sku: {
            type: 'object',
            nullable: true,
            properties: {
              skuId: uuid,
              skuCode: { type: 'string' },
              productName: { type: 'string' },
            },
          },
          lpnCode: { type: 'string', nullable: true },
          binCode: { type: 'string', nullable: true },
          ...timestamps,
        },
      },
      InventoryMovement: {
        type: 'object',
        properties: {
          movementId: uuid,
          inventoryId: uuid,
          movementType: {
            type: 'string',
            enum: [
              'INBOUND',
              'PUTAWAY',
              'RELOCATION',
              'PICKING',
              'OUTBOUND',
              'SHIPPING',
              'ADJUSTMENT',
            ],
          },
          fromBinId: { ...uuid, nullable: true },
          toBinId: { ...uuid, nullable: true },
          quantity: { type: 'integer' },
          movedBy: { ...uuid, nullable: true },
          movedAt: { type: 'string', format: 'date-time', nullable: true },
          note: { type: 'string', nullable: true },
        },
      },

      OutboundRequest: {
        type: 'object',
        properties: {
          outboundRequestId: uuid,
          tenantId: uuid,
          contractId: uuid,
          warehouseId: uuid,
          outboundCode: { type: 'string', example: 'OUT-LX1A2B-0C' },
          requestedShipDate: { type: 'string', format: 'date-time', nullable: true },
          actualShippedAt: { type: 'string', format: 'date-time', nullable: true },
          status: {
            type: 'string',
            enum: [
              'DRAFT',
              'PENDING',
              'APPROVED',
              'RESERVED',
              'PICKING',
              'PACKING',
              'SHIPPED',
              'COMPLETED',
              'CANCELLED',
            ],
          },
          createdBy: { ...uuid, nullable: true },
          approvedBy: { ...uuid, nullable: true },
          ...timestamps,
        },
      },
      OutboundRequestCreate: {
        type: 'object',
        description:
          'Required: `tenantId`, `contractId`, `warehouseId`. Gửi `items[]` (SKU + qty) cùng lúc hoặc thêm sau qua `POST …/items`. Status `PENDING` bắt buộc có ít nhất 1 dòng.',
        required: ['tenantId', 'contractId', 'warehouseId'],
        example: {
          tenantId: '98cad623-9071-4f40-8f41-196940a9338d',
          contractId: 'a5f86099-adcf-4151-8c90-884d16b9e6e2',
          warehouseId: 'f2af9626-635b-4fe2-a149-3ab5b33b153e',
          requestedShipDate: '2026-06-20T08:00:00.000Z',
          status: 'PENDING',
          items: [{ skuId: 'b1c2d3e4-0000-4000-8000-000000000001', requestedQuantity: 10 }],
        },
        properties: {
          tenantId: uuid,
          contractId: uuid,
          warehouseId: uuid,
          requestedShipDate: { type: 'string', format: 'date-time' },
          actualShippedAt: { type: 'string', format: 'date-time' },
          status: {
            type: 'string',
            enum: [
              'DRAFT',
              'PENDING',
              'APPROVED',
              'RESERVED',
              'PICKING',
              'PACKING',
              'SHIPPED',
              'COMPLETED',
              'CANCELLED',
            ],
            default: 'PENDING',
          },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OutboundRequestItemCreateNested' },
            description: 'Optional — tạo dòng SKU cùng phiếu xuất',
          },
        },
      },
      OutboundRequestUpdate: {
        type: 'object',
        description:
          'Không gửi `approvedBy` — khi `status: APPROVED` server lấy user từ Bearer token, reserve FIFO, chuyển `RESERVED`. `PACKING`/`SHIPPED` chạy pick/ship workflow.',
        properties: {
          requestedShipDate: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          actualShippedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Tùy chọn; mặc định server set khi `SHIPPED`',
          },
          status: {
            type: 'string',
            enum: [
              'DRAFT',
              'PENDING',
              'APPROVED',
              'RESERVED',
              'PICKING',
              'PACKING',
              'SHIPPED',
              'COMPLETED',
              'CANCELLED',
            ],
          },
        },
      },
      OutboundRequestWithItems: {
        allOf: [
          { $ref: '#/components/schemas/OutboundRequest' },
          {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/OutboundRequestItem' },
              },
            },
          },
        ],
      },
      OutboundRequestItem: {
        type: 'object',
        properties: {
          outboundRequestItemId: uuid,
          outboundRequestId: uuid,
          skuId: uuid,
          requestedQuantity: { type: 'integer', minimum: 1 },
          allocatedQuantity: { type: 'integer', minimum: 0, default: 0 },
          pickedQuantity: { type: 'integer', minimum: 0, default: 0 },
          sku: {
            type: 'object',
            properties: {
              skuId: uuid,
              skuCode: { type: 'string' },
              productName: { type: 'string' },
              color: { type: 'string', nullable: true },
              size: { type: 'string', nullable: true },
            },
          },
        },
      },
      OutboundRequestItemCreateNested: {
        type: 'object',
        required: ['skuId', 'requestedQuantity'],
        properties: {
          skuId: uuid,
          requestedQuantity: { type: 'integer', minimum: 1 },
        },
      },
      OutboundRequestItemCreate: {
        type: 'object',
        required: ['skuId', 'requestedQuantity'],
        properties: {
          outboundRequestId: {
            ...uuid,
            description:
              'Required on POST /outbound-request-items; omitted when nested under outbound',
          },
          skuId: uuid,
          requestedQuantity: { type: 'integer', minimum: 1 },
        },
      },
      OutboundRequestItemUpdate: {
        type: 'object',
        properties: {
          requestedQuantity: { type: 'integer', minimum: 1 },
        },
      },
      PickingTaskItem: {
        type: 'object',
        properties: {
          pickingTaskItemId: uuid,
          pickingTaskId: uuid,
          inventoryId: uuid,
          lpnId: uuid,
          binId: uuid,
          batchId: uuid,
          quantityToPick: { type: 'integer', minimum: 1 },
          pickedQuantity: { type: 'integer', minimum: 0, default: 0 },
        },
      },
      PickingTask: {
        type: 'object',
        properties: {
          pickingTaskId: uuid,
          outboundRequestId: uuid,
          assignedTo: { ...uuid, nullable: true },
          status: {
            type: 'string',
            enum: ['PENDING', 'PICKING', 'COMPLETED', 'CANCELLED'],
          },
          createdAt: { type: 'string', format: 'date-time', nullable: true },
          updatedAt: { type: 'string', format: 'date-time', nullable: true },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/PickingTaskItem' },
          },
        },
      },

      Lpn: {
        type: 'object',
        properties: {
          lpnId: uuid,
          tenantId: uuid,
          batchId: uuid,
          lpnCode: { type: 'string', example: 'LPN-2026-00001' },
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          volumeUnits: {
            type: 'integer',
            description: 'SMALL=1, MEDIUM=2, LARGE=4, EXTRA=8',
          },
          maxCapacity: { type: 'integer', nullable: true },
          actualQuantity: { type: 'integer', default: 0 },
          fillPercentage: { type: 'number', nullable: true },
          weightKg: {
            type: 'number',
            nullable: true,
            description: 'Carton weight in kg (receiving / putaway)',
          },
          currentBinId: { ...uuid, nullable: true },
          status: {
            type: 'string',
            enum: ['RECEIVING', 'STORED', 'PICKED', 'SHIPPED', 'DAMAGED'],
          },
          ...timestamps,
        },
      },
      LpnRackSuggestion: {
        type: 'object',
        properties: {
          lpnId: uuid,
          lpnCode: { type: 'string' },
          weightKg: { type: 'number', nullable: true },
          suggestedRackType: { type: 'string', enum: ['STANDARD'] },
          thresholdKg: { type: 'number' },
          reason: { type: 'string' },
          warehouseId: uuid,
          note: { type: 'string', nullable: true },
          suitableRackLevels: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rackLevelId: uuid,
                levelCode: { type: 'string', nullable: true },
                levelNumber: { type: 'integer' },
                maxWeightKg: { type: 'number', nullable: true },
                rackId: uuid,
                rackCode: { type: 'string' },
                rackType: { type: 'string', enum: ['STANDARD'] },
                zoneId: uuid,
                zoneCode: { type: 'string' },
              },
            },
          },
        },
      },
      AiSlotRecommendationCreate: {
        type: 'object',
        required: ['lpnId', 'warehouseId'],
        description: 'Flow 5 — dùng cho `POST …/preview` và `POST …/slot-recommendations`.',
        properties: {
          lpnId: uuid,
          warehouseId: uuid,
          inboundRequestId: {
            ...uuid,
            description: 'Optional — gắn audit với inbound; phải cùng tenant với LPN',
          },
        },
      },
      AiSlotExplainRequest: {
        type: 'object',
        required: ['llmProvider'],
        properties: {
          llmProvider: {
            type: 'string',
            enum: ['gemini', 'ollama'],
            description: 'Required. No fallback to the other provider.',
          },
          recommendationId: uuid,
          lpnId: uuid,
          warehouseId: uuid,
          inboundRequestId: uuid,
          slot: {
            type: 'object',
            description: 'Optional: full preview response to explain without re-running rule engine',
          },
        },
      },
      OllamaHealth: {
        type: 'object',
        properties: {
          reachable: { type: 'boolean' },
          enabled: { type: 'boolean' },
          baseUrl: { type: 'string', example: 'http://127.0.0.1:11434' },
          model: { type: 'string', example: 'llama3.2:3b' },
          modelAvailable: { type: 'boolean' },
          models: { type: 'array', items: { type: 'string' } },
          message: { type: 'string' },
        },
      },
      AiSlotLlmExplanation: {
        type: 'object',
        properties: {
          recommendationId: uuid,
          lpnCode: { type: 'string', nullable: true },
          zoneCode: { type: 'string', nullable: true },
          binCode: { type: 'string', nullable: true },
          recommendationScore: { type: 'number', nullable: true },
          reasons: { type: 'array', items: { type: 'string' } },
          explanation: {
            type: 'string',
            description: 'Vietnamese explanation from Ollama',
          },
          llmModel: { type: 'string', example: 'llama3.2:3b' },
          ollamaBaseUrl: { type: 'string' },
          totalDurationNs: { type: 'integer', nullable: true },
        },
      },
      AiSlotAlternative: {
        type: 'object',
        properties: {
          recommendedZoneId: uuid,
          recommendedRackId: uuid,
          recommendedRackLevelId: uuid,
          recommendedBinId: uuid,
          zoneCode: { type: 'string' },
          rackCode: { type: 'string' },
          levelNumber: { type: 'integer', nullable: true },
          binCode: { type: 'string' },
          score: { type: 'number' },
          reasons: { type: 'array', items: { type: 'string' } },
        },
      },
      AiSlotRecommendation: {
        type: 'object',
        properties: {
          recommendationId: uuid,
          inboundRequestId: { ...uuid, nullable: true },
          lpnId: { ...uuid, nullable: true },
          skuId: { ...uuid, nullable: true },
          recommendedZoneId: { ...uuid, nullable: true },
          recommendedRackId: { ...uuid, nullable: true },
          recommendedRackLevelId: { ...uuid, nullable: true },
          recommendedBinId: { ...uuid, nullable: true },
          recommendationScore: { type: 'number', nullable: true },
          reason: {
            type: 'string',
            description: 'JSON: reasons, modelVersion, featureSnapshot',
          },
          isApplied: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          parsedReason: { type: 'object', nullable: true },
          alternatives: {
            type: 'array',
            items: { $ref: '#/components/schemas/AiSlotAlternative' },
          },
          zoneCode: { type: 'string', nullable: true },
          rackCode: { type: 'string', nullable: true },
          levelNumber: { type: 'integer', nullable: true },
          binCode: { type: 'string', nullable: true },
          suggestedRackType: {
            type: 'string',
            enum: ['STANDARD'],
            nullable: true,
          },
          reasons: { type: 'array', items: { type: 'string' } },
          featureSnapshot: { type: 'object', nullable: true },
          modelVersion: { type: 'string', example: 'slotting-v1-rule' },
          llmExplanation: { type: 'string', nullable: true },
          llmModel: { type: 'string', nullable: true },
          llmProvider: { type: 'string', enum: ['gemini', 'ollama'], nullable: true },
          llmError: { type: 'string', nullable: true },
          llmErrorCode: { type: 'string', nullable: true },
        },
      },
      AiSlotRecommendationPreview: {
        type: 'object',
        properties: {
          lpnId: uuid,
          lpnCode: { type: 'string' },
          tenantId: uuid,
          warehouseId: uuid,
          recommendedZoneId: uuid,
          recommendedRackId: uuid,
          recommendedRackLevelId: uuid,
          recommendedBinId: uuid,
          zoneCode: { type: 'string' },
          rackCode: { type: 'string' },
          levelNumber: { type: 'integer', nullable: true },
          binCode: { type: 'string' },
          score: { type: 'number' },
          reasons: { type: 'array', items: { type: 'string' } },
          featureSnapshot: { type: 'object' },
          modelVersion: { type: 'string' },
          suggestedRackType: { type: 'string', enum: ['STANDARD'] },
          alternatives: {
            type: 'array',
            items: { $ref: '#/components/schemas/AiSlotAlternative' },
          },
          llmExplanation: { type: 'string', nullable: true },
          llmModel: { type: 'string', nullable: true },
          llmProvider: { type: 'string', enum: ['gemini', 'ollama'], nullable: true },
          llmError: { type: 'string', nullable: true },
          llmErrorCode: { type: 'string', nullable: true },
        },
      },
      AiSlotRecommendationUpdate: {
        type: 'object',
        properties: {
          isApplied: { type: 'boolean' },
        },
      },
      LpnCreate: {
        type: 'object',
        required: ['tenantId', 'batchId', 'lpnCode', 'boxType', 'volumeUnits'],
        description:
          '1 LPN = 1 thùng. `volumeUnits` theo `boxType`: SMALL=1, MEDIUM=2, LARGE=4, EXTRA=8.',
        properties: {
          tenantId: uuid,
          batchId: uuid,
          lpnCode: { type: 'string' },
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          volumeUnits: {
            type: 'integer',
            minimum: 1,
            description: 'SMALL=1, MEDIUM=2, LARGE=4, EXTRA=8 (align with boxType)',
          },
          maxCapacity: { type: 'integer', minimum: 1 },
          actualQuantity: { type: 'integer', minimum: 0, default: 0 },
          fillPercentage: { type: 'number', minimum: 0, maximum: 100 },
          weightKg: { type: 'number', minimum: 0, description: 'Carton weight in kg' },
          currentBinId: uuid,
          status: {
            type: 'string',
            enum: ['RECEIVING', 'STORED', 'PICKED', 'SHIPPED', 'DAMAGED'],
            default: 'RECEIVING',
          },
        },
      },
      LpnUpdate: {
        type: 'object',
        properties: {
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          volumeUnits: { type: 'integer', minimum: 1 },
          maxCapacity: { type: 'integer', minimum: 1 },
          actualQuantity: { type: 'integer', minimum: 0 },
          fillPercentage: { type: 'number', minimum: 0, maximum: 100 },
          weightKg: { type: 'number', minimum: 0, nullable: true },
          currentBinId: { ...uuid, nullable: true },
          status: {
            type: 'string',
            enum: ['RECEIVING', 'STORED', 'PICKED', 'SHIPPED', 'DAMAGED'],
          },
        },
      },

      LpnDetailSku: {
        type: 'object',
        properties: {
          skuId: uuid,
          skuCode: { type: 'string' },
          productName: { type: 'string' },
          color: { type: 'string', nullable: true },
          size: { type: 'string', nullable: true },
        },
      },
      LpnDetail: {
        type: 'object',
        properties: {
          lpnDetailId: uuid,
          lpnId: uuid,
          skuId: uuid,
          quantity: { type: 'integer', minimum: 1 },
          sku: { $ref: '#/components/schemas/LpnDetailSku' },
        },
      },
      LpnDetailCreate: {
        type: 'object',
        required: ['lpnId', 'skuId', 'quantity'],
        properties: {
          lpnId: uuid,
          skuId: uuid,
          quantity: { type: 'integer', minimum: 1 },
        },
      },
      LpnDetailUpdate: {
        type: 'object',
        properties: {
          quantity: { type: 'integer', minimum: 1 },
        },
      },
      LpnWithDetails: {
        allOf: [
          { $ref: '#/components/schemas/Lpn' },
          {
            type: 'object',
            properties: {
              details: {
                type: 'array',
                items: { $ref: '#/components/schemas/LpnDetail' },
              },
            },
          },
        ],
      },

      HealthData: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          database: { type: 'string', example: 'connected' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },

      User: {
        type: 'object',
        properties: {
          userId: uuid,
          tenantId: { ...uuid, nullable: true },
          warehouseId: { ...uuid, nullable: true },
          fullName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', nullable: true },
          role: {
            type: 'string',
            enum: ['SYSTEM_ADMIN', 'WH_ADMIN', 'WH_STAFF', 'TENANT_ADMIN', 'TENANT_STAFF'],
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED'],
          },
          ...timestamps,
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'admin@warehouse.local',
          },
          password: {
            type: 'string',
            format: 'password',
            example: 'Admin@12345',
          },
        },
      },
      UserCreate: {
        type: 'object',
        required: ['fullName', 'email', 'password', 'role'],
        properties: {
          fullName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password', minLength: 8 },
          phone: { type: 'string' },
          role: {
            type: 'string',
            enum: ['WH_ADMIN', 'TENANT_ADMIN', 'WH_STAFF', 'TENANT_STAFF'],
            description:
              'SYSTEM_ADMIN may create WH_ADMIN, TENANT_ADMIN. WH_ADMIN → WH_STAFF. TENANT_ADMIN → TENANT_STAFF.',
          },
          warehouseId: {
            ...uuid,
            description:
              'Required when SYSTEM_ADMIN creates WH_ADMIN. WH_ADMIN creating WH_STAFF may omit (inherited from admin).',
          },
          tenantId: {
            ...uuid,
            description:
              'Required when SYSTEM_ADMIN creates TENANT_ADMIN. TENANT_ADMIN creating TENANT_STAFF may omit (inherited).',
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED'],
            default: 'ACTIVE',
          },
        },
      },
      UserUpdate: {
        type: 'object',
        properties: {
          fullName: { type: 'string' },
          phone: { type: 'string' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED'],
          },
        },
      },
      LoginData: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
        },
      },

      ForgotPasswordRequest: {
        type: 'object',
        required: ['email'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'user@warehouse.local',
            description: 'Email của tài khoản cần đặt lại mật khẩu.',
          },
        },
      },
      ForgotPasswordRequestData: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          expiresInMinutes: { type: 'integer', example: 10 },
        },
      },
      ForgotPasswordVerifyRequest: {
        type: 'object',
        required: ['email', 'otp', 'newPassword'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@warehouse.local' },
          otp: { type: 'string', example: '123456' },
          newPassword: {
            type: 'string',
            format: 'password',
            minLength: 8,
            description: 'Mật khẩu mới, tối thiểu 8 ký tự.',
          },
        },
      },
      ForgotPasswordVerifyData: {
        type: 'object',
        properties: {
          changedAt: { type: 'string', format: 'date-time' },
        },
      },

      ChangePasswordRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', format: 'password' },
          newPassword: {
            type: 'string',
            format: 'password',
            minLength: 8,
            description: 'Phải khác mật khẩu hiện tại, tối thiểu 8 ký tự.',
          },
        },
      },
      ChangePasswordData: {
        type: 'object',
        properties: {
          changedAt: { type: 'string', format: 'date-time' },
        },
      },

      RentalRequestProductLineInput: {
        type: 'object',
        description:
          'Một dòng **Quy mô hàng hóa** (loại hàng + size + số cái/tháng). Mã `productKind` lấy từ `GET /api/product-kinds`.',
        required: ['productKind', 'quantity'],
        properties: {
          productKind: {
            type: 'string',
            example: 'T_SHIRT',
            description: 'Mã loại hàng (catalog product kind), uppercase',
          },
          size: {
            type: 'string',
            example: 'M',
            description: 'Size (bắt buộc nếu loại hàng có size trong catalog)',
          },
          sizeGroup: {
            type: 'string',
            example: 'ADULT_TOP',
            description: 'Optional — server resolve từ `size` nếu bỏ qua',
          },
          quantity: {
            type: 'integer',
            minimum: 1,
            example: 200,
            description: 'Số cái cam kết trung bình **mỗi tháng** (peak inventory)',
          },
          sortOrder: {
            type: 'integer',
            minimum: 0,
            description: 'Thứ tự hiển thị (mặc định theo index mảng)',
          },
        },
      },
      RentalRequestProductLine: {
        type: 'object',
        description: 'Dòng hàng đã lưu — server tính volume units (U) và phân bổ thùng.',
        properties: {
          lineId: uuid,
          rentalRequestId: uuid,
          productKind: { type: 'string', example: 'T_SHIRT' },
          size: { type: 'string', nullable: true, example: 'M' },
          sizeGroup: { type: 'string', nullable: true },
          quantity: { type: 'integer', example: 200 },
          baseVolumeUnitsPerPiece: { type: 'number', example: 1 },
          sizeFactor: { type: 'number', example: 1 },
          finalVolumeUnitsPerPiece: { type: 'number', example: 1 },
          lineVolumeUnits: { type: 'number', example: 200 },
          sortOrder: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      RentalRequestBoxAllocationRow: {
        type: 'object',
        properties: {
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          count: { type: 'integer', minimum: 0 },
        },
      },
      RentalRequest: {
        type: 'object',
        description:
          'Guest chọn khu vực; `warehouseId` null cho đến khi một warehouse approve (claim). `GET` by id luôn kèm `productLines`; list dùng `includeProductLines=true`.',
        properties: {
          rentalRequestId: uuid,
          requestCode: { type: 'string', example: 'RR-LX1A2B-0C' },
          tenantId: uuid,
          city: { type: 'string', example: 'TP.HCM' },
          district: { type: 'string', example: 'Quận 7' },
          warehouseId: {
            ...uuid,
            nullable: true,
            description: 'Null until a warehouse claims via PATCH status=APPROVED',
          },
          contractType: {
            type: 'string',
            enum: [
              'SHARED_STORAGE',
              'RESERVED_STORAGE',
              'DEDICATED_ZONE',
              'DEDICATED_WAREHOUSE',
            ],
            nullable: true,
          },
          pricingModel: {
            type: 'string',
            enum: ['USAGE_BASED', 'FIXED', 'HYBRID'],
            nullable: true,
          },
          billingCycle: {
            type: 'string',
            enum: ['DAILY', 'MONTHLY', 'QUARTERLY', 'YEARLY'],
            nullable: true,
          },
          estimatedSkuCount: { type: 'integer', nullable: true },
          estimatedBoxCount: { type: 'integer', nullable: true },
          estimatedVolume: { type: 'number', nullable: true },
          requestedAreaM2: {
            type: 'number',
            nullable: true,
            description: 'Diện tích mong muốn (m²) — DEDICATED_WAREHOUSE / DEDICATED_ZONE',
          },
          totalCommittedVolumeUnits: {
            type: 'number',
            nullable: true,
            description: 'Tổng U từ productLines (server tính)',
          },
          boxAllocation: {
            type: 'array',
            items: { $ref: '#/components/schemas/RentalRequestBoxAllocationRow' },
            description: 'Phân bổ số thùng theo loại (từ tổng U)',
          },
          productLines: {
            type: 'array',
            items: { $ref: '#/components/schemas/RentalRequestProductLine' },
          },
          averageStorageDays: { type: 'integer', nullable: true },
          estimatedInboundPerWeek: { type: 'integer', nullable: true },
          estimatedOutboundPerWeek: { type: 'integer', nullable: true },
          requiresFastPicking: { type: 'boolean' },
          requiresPremiumStorage: { type: 'boolean' },
          notes: { type: 'string', nullable: true },
          suggestedZoneType: {
            type: 'string',
            enum: ['SHARED', 'FAST_MOVING', 'PREMIUM', 'PRIVATE'],
            nullable: true,
          },
          suggestedRackType: {
            type: 'string',
            enum: ['STANDARD'],
            nullable: true,
          },
          expectedStartDate: { type: 'string', format: 'date-time', nullable: true },
          expectedEndDate: { type: 'string', format: 'date-time', nullable: true },
          status: {
            type: 'string',
            enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED'],
          },
          reviewedBy: { ...uuid, nullable: true },
          reviewedAt: { type: 'string', format: 'date-time', nullable: true },
          rejectionReason: { type: 'string', nullable: true },
          reviewNote: { type: 'string', nullable: true },
          createdBy: { ...uuid, nullable: true },
          ...timestamps,
        },
      },
      RentalRequestCreate: {
        type: 'object',
        description:
          'Guest onboarding bước 2. Tạo tenant trước (`POST /tenants`). **Không gửi `warehouseId`** — kho được gán khi WH approve. Required: `tenantId`, `city`, `district`.\n\n' +
          '**Quy mô hàng hóa**: gửi `productLines[]` (loại + size + quantity/tháng) **hoặc** `requestedAreaM2` > 0 **hoặc** các ước tính legacy (`estimatedVolume`, `estimatedBoxCount`, …) — cần ít nhất một nguồn capacity.\n\n' +
          '`createdBy`: có Bearer token thì lấy `userId`, guest thì `null`.',
        required: ['tenantId', 'city', 'district'],
        properties: {
          tenantId: uuid,
          city: { type: 'string', example: 'TP.HCM', description: 'Thành phố tenant muốn thuê kho' },
          district: { type: 'string', example: 'Quận 7', description: 'Quận/huyện' },
          contractType: {
            type: 'string',
            enum: [
              'SHARED_STORAGE',
              'RESERVED_STORAGE',
              'DEDICATED_ZONE',
              'DEDICATED_WAREHOUSE',
            ],
          },
          pricingModel: {
            type: 'string',
            enum: ['USAGE_BASED', 'FIXED', 'HYBRID'],
          },
          billingCycle: {
            type: 'string',
            enum: ['DAILY', 'MONTHLY', 'QUARTERLY', 'YEARLY'],
          },
          productLines: {
            type: 'array',
            items: { $ref: '#/components/schemas/RentalRequestProductLineInput' },
            description: 'Hàng theo loại + size — UI "Quy mô hàng hóa"',
          },
          estimatedSkuCount: { type: 'integer', minimum: 0 },
          estimatedBoxCount: { type: 'integer', minimum: 0 },
          estimatedVolume: { type: 'number', minimum: 0 },
          requestedAreaM2: {
            type: 'number',
            minimum: 0,
            description: 'Diện tích mong muốn (m²) — thuê nguyên kho / zone (thay cho productLines)',
          },
          averageStorageDays: { type: 'integer', minimum: 0 },
          estimatedInboundPerWeek: { type: 'integer', minimum: 0 },
          estimatedOutboundPerWeek: { type: 'integer', minimum: 0 },
          requiresFastPicking: { type: 'boolean', default: false },
          requiresPremiumStorage: { type: 'boolean', default: false },
          notes: { type: 'string' },
          suggestedZoneType: {
            type: 'string',
            enum: ['SHARED', 'FAST_MOVING', 'PREMIUM', 'PRIVATE'],
          },
          suggestedRackType: {
            type: 'string',
            enum: ['STANDARD'],
          },
          expectedStartDate: { type: 'string', format: 'date-time' },
          expectedEndDate: { type: 'string', format: 'date-time' },
          status: {
            type: 'string',
            enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED'],
            default: 'PENDING',
          },
        },
        example: {
          tenantId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          city: 'TP.HCM',
          district: 'Quận 7',
          contractType: 'SHARED_STORAGE',
          pricingModel: 'USAGE_BASED',
          billingCycle: 'MONTHLY',
          expectedStartDate: '2026-06-02T00:00:00.000Z',
          expectedEndDate: '2026-12-02T00:00:00.000Z',
          productLines: [
            { productKind: 'T_SHIRT', size: 'M', quantity: 200 },
            { productKind: 'JEANS', size: 'L', quantity: 80 },
          ],
          requiresFastPicking: false,
          requiresPremiumStorage: false,
          notes: 'Brand mùa hè — cần fast-moving zone',
        },
      },
      Contract: {
        type: 'object',
        properties: {
          contractId: uuid,
          tenantId: uuid,
          warehouseId: uuid,
          rentalRequestId: { ...uuid, nullable: true },
          contractCode: { type: 'string', example: 'CTR-LX1A2B-0C' },
          contractName: { type: 'string', nullable: true },
          contractType: {
            type: 'string',
            enum: [
              'SHARED_STORAGE',
              'RESERVED_STORAGE',
              'DEDICATED_ZONE',
              'DEDICATED_WAREHOUSE',
            ],
          },
          pricingModel: {
            type: 'string',
            enum: ['USAGE_BASED', 'FIXED', 'HYBRID'],
          },
          billingCycle: {
            type: 'string',
            enum: ['MONTHLY', 'YEARLY'],
            nullable: true,
          },
          allowDynamicRelocation: { type: 'boolean' },
          autoRenew: { type: 'boolean' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          minimumBillingDays: { type: 'integer', nullable: true },
          minimumReservedCapacity: { type: 'number', nullable: true },
          estimatedTotalAmount: { type: 'number', nullable: true },
          status: {
            type: 'string',
            enum: [
              'DRAFT',
              'PENDING_APPROVAL',
              'PENDING_PAYMENT',
              'ACTIVE',
              'EXPIRED',
              'TERMINATED',
              'CANCELLED',
            ],
          },
          tenantSignature: { type: 'string', nullable: true },
          warehouseSignature: { type: 'string', nullable: true },
          createdBy: { ...uuid, nullable: true },
          approvedBy: { ...uuid, nullable: true },
          ...timestamps,
        },
      },
      ContractCreate: {
        type: 'object',
        description:
          'Required fields: `tenantId`, `warehouseId`, `contractType`, `pricingModel`, `startDate`, `endDate`. Field khác optional.',
        required: [
          'tenantId',
          'warehouseId',
          'contractType',
          'pricingModel',
          'startDate',
          'endDate',
        ],
        properties: {
          tenantId: uuid,
          warehouseId: uuid,
          rentalRequestId: uuid,
          contractName: { type: 'string' },
          contractType: {
            type: 'string',
            enum: [
              'SHARED_STORAGE',
              'RESERVED_STORAGE',
              'DEDICATED_ZONE',
              'DEDICATED_WAREHOUSE',
            ],
          },
          pricingModel: {
            type: 'string',
            enum: ['USAGE_BASED', 'FIXED', 'HYBRID'],
          },
          billingCycle: {
            type: 'string',
            enum: ['MONTHLY', 'YEARLY'],
            default: 'MONTHLY',
          },
          allowDynamicRelocation: { type: 'boolean', default: true },
          autoRenew: { type: 'boolean', default: false },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          minimumBillingDays: { type: 'integer', minimum: 0, default: 1 },
          minimumReservedCapacity: { type: 'number', minimum: 0 },
          estimatedTotalAmount: { type: 'number', minimum: 0 },
          status: {
            type: 'string',
            enum: [
              'DRAFT',
              'PENDING_APPROVAL',
              'PENDING_PAYMENT',
              'ACTIVE',
              'EXPIRED',
              'TERMINATED',
              'CANCELLED',
            ],
            default: 'DRAFT',
          },
          tenantSignature: { type: 'string' },
          warehouseSignature: { type: 'string' },
          createdBy: uuid,
          approvedBy: uuid,
        },
      },
      ContractUpdate: {
        type: 'object',
        description:
          'Workflow ký HĐ + PayOS:\n' +
          '- Submit: `{ status: PENDING_APPROVAL }`\n' +
          '- Tenant ký: `{ tenantSignature }` → `PENDING_PAYMENT` + invoice INITIAL\n' +
          '- Thanh toán: `POST .../payos/create-link` → PayOS → webhook → `ACTIVE`\n' +
          '- Dev ghi nhận tay: `POST .../mark-paid` (không qua PayOS)\n' +
          '- Huỷ/kết thúc: `{ status: TERMINATED }` hoặc `{ status: CANCELLED }`',
        properties: {
          contractName: { type: 'string' },
          contractType: {
            type: 'string',
            enum: [
              'SHARED_STORAGE',
              'RESERVED_STORAGE',
              'DEDICATED_ZONE',
              'DEDICATED_WAREHOUSE',
            ],
          },
          pricingModel: {
            type: 'string',
            enum: ['USAGE_BASED', 'FIXED', 'HYBRID'],
          },
          billingCycle: {
            type: 'string',
            enum: ['MONTHLY', 'YEARLY'],
          },
          allowDynamicRelocation: { type: 'boolean' },
          autoRenew: { type: 'boolean' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          minimumBillingDays: { type: 'integer', minimum: 0 },
          minimumReservedCapacity: { type: 'number', minimum: 0 },
          estimatedTotalAmount: { type: 'number', minimum: 0 },
          status: {
            type: 'string',
            enum: [
              'DRAFT',
              'PENDING_APPROVAL',
              'PENDING_PAYMENT',
              'ACTIVE',
              'EXPIRED',
              'TERMINATED',
              'CANCELLED',
            ],
          },
          tenantSignature: { type: 'string' },
          warehouseSignature: { type: 'string' },
          approvedBy: uuid,
        },
      },

      ContractAppendix: {
        type: 'object',
        properties: {
          appendixId: uuid,
          contractId: uuid,
          appendixCode: { type: 'string', example: 'CTR-ABC-PL01' },
          appendixNumber: { type: 'integer', example: 1 },
          title: { type: 'string', nullable: true },
          status: {
            type: 'string',
            enum: [
              'PENDING',
              'UNDER_REVIEW',
              'REJECTED',
              'PENDING_APPROVAL',
              'PENDING_PAYMENT',
              'ACTIVE',
              'TERMINATED',
              'CANCELLED',
              'DRAFT',
            ],
          },
          effectiveDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          estimatedDeltaAmount: {
            type: 'number',
            description: 'Đơn giá/tháng — WH nhập khi duyệt',
          },
          maxStorageLevel: {
            type: 'string',
            enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
            nullable: true,
            description: 'Trần cấp HĐ gốc tại thời điểm tạo yêu cầu',
          },
          requestedBy: { ...uuid, nullable: true },
          requestedStorageLevel: {
            type: 'string',
            enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
            nullable: true,
          },
          rejectionReason: { type: 'string', nullable: true },
          reviewNote: { type: 'string', nullable: true },
          reviewedBy: { ...uuid, nullable: true },
          reviewedAt: { type: 'string', format: 'date-time', nullable: true },
          tenantSignature: { type: 'string', nullable: true },
          warehouseSignature: { type: 'string', nullable: true },
          createdBy: { ...uuid, nullable: true },
          approvedBy: { ...uuid, nullable: true },
          terminatedAt: { type: 'string', format: 'date-time', nullable: true },
          terminationReason: { type: 'string', nullable: true },
          ...timestamps,
        },
      },
      ContractAppendixCreate: {
        type: 'object',
        required: ['effectiveDate', 'endDate'],
        description:
          '**TENANT_ADMIN** — gửi yêu cầu thuê thêm. Cấp > trần → `400` `APPENDIX_NEED_NEW_CONTRACT`. Giá do WH nhập khi duyệt.',
        properties: {
          title: { type: 'string' },
          effectiveDate: { type: 'string', format: 'date' },
          endDate: {
            type: 'string',
            format: 'date',
            description: '≤ endDate HĐ gốc; có thể ngắn hơn HĐ',
          },
          requestedStorageLevel: {
            type: 'string',
            enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
          },
            items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['itemType', 'billingUnit'],
              properties: {
                itemType: {
                  type: 'string',
                  enum: ['STORAGE', 'INBOUND', 'OUTBOUND', 'HANDLING', 'REPACKING', 'SLA'],
                },
                storageLevel: {
                  type: 'string',
                  enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
                },
                billingUnit: { type: 'string' },
                quantity: { type: 'number' },
                reservedQuantity: { type: 'integer' },
                boxType: { type: 'string' },
                unitPrice: { type: 'number' },
              },
            },
          },
          reservations: {
            type: 'array',
            items: { $ref: '#/components/schemas/StorageReservationCreate' },
          },
        },
        example: {
          title: 'Thuê thêm 2 bin',
          effectiveDate: '2026-01-15',
          endDate: '2026-03-31',
          requestedStorageLevel: 'BIN',
          items: [
            {
              itemType: 'STORAGE',
              storageLevel: 'BIN',
              billingUnit: 'BIN_DAY',
              quantity: 2,
            },
          ],
        },
      },
      ContractAppendixApprove: {
        type: 'object',
        required: ['estimatedDeltaAmount', 'warehouseSignature'],
        description: '**WH_ADMIN** — duyệt, cấp giá/tháng, ký kho, gán reservation (tùy chọn).',
        properties: {
          estimatedDeltaAmount: { type: 'number', minimum: 0 },
          warehouseSignature: { type: 'string' },
          reviewNote: { type: 'string' },
          items: { type: 'array', items: { type: 'object' } },
          reservations: {
            type: 'array',
            items: { $ref: '#/components/schemas/StorageReservationCreate' },
          },
        },
      },
      ContractAppendixReject: {
        type: 'object',
        required: ['rejectionReason'],
        properties: {
          rejectionReason: { type: 'string' },
          reviewNote: { type: 'string' },
        },
      },
      ContractAppendixSign: {
        type: 'object',
        required: ['tenantSignature'],
        description: '**TENANT_ADMIN** — ký khi `PENDING_APPROVAL`.',
        properties: {
          tenantSignature: { type: 'string' },
        },
      },
      ContractAppendixCeiling: {
        type: 'object',
        properties: {
          contractId: uuid,
          ceilingLevel: {
            type: 'string',
            enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
          },
        },
      },
      ContractAppendixPaymentPreview: {
        type: 'object',
        properties: {
          appendixId: uuid,
          contractBillingCycle: { type: 'string', enum: ['MONTHLY', 'YEARLY'] },
          monthlyRate: { type: 'number', description: 'estimatedDeltaAmount' },
          billableMonths: {
            type: 'number',
            description: 'Số tháng thực tế (có thập phân), VD ~2.5',
          },
          initialInvoiceAmount: {
            type: 'number',
            description: 'round(monthlyRate × billableMonths)',
          },
          effectiveDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
        },
      },
      ContractAppendixTerminate: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Lý do (optional)' },
        },
      },

      ContractInvoice: {
        type: 'object',
        properties: {
          invoiceId: uuid,
          tenantId: uuid,
          contractId: uuid,
          appendixId: {
            ...uuid,
            nullable: true,
            description: 'Có khi invoice thuộc phụ lục',
          },
          invoiceCode: { type: 'string', example: 'INV-M2ABC-01' },
          billingStartDate: { type: 'string', format: 'date' },
          billingEndDate: { type: 'string', format: 'date' },
          subtotal: { type: 'number', nullable: true },
          tax: { type: 'number', nullable: true },
          totalAmount: { type: 'number', nullable: true },
          paymentStatus: {
            type: 'string',
            enum: ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'],
          },
          invoiceCategory: {
            type: 'string',
            enum: [
              'INITIAL',
              'APPENDIX_INITIAL',
              'RECURRING_RENT',
              'OPERATIONAL',
              'TERMINATION_SETTLEMENT',
            ],
            nullable: true,
          },
          issuedAt: { type: 'string', format: 'date-time', nullable: true },
          dueDate: { type: 'string', format: 'date-time', nullable: true },
          ...timestamps,
        },
      },
      PayOSCreateLinkRequest: {
        type: 'object',
        properties: {
          returnUrl: {
            type: 'string',
            format: 'uri',
            description: 'Optional — mặc định FE /staff/contracts/payment/return',
          },
          cancelUrl: {
            type: 'string',
            format: 'uri',
            description: 'Optional — mặc định FE /staff/contracts/payment/cancel',
          },
        },
      },
      PayOSPaymentLink: {
        type: 'object',
        properties: {
          orderCode: { type: 'integer', example: 1717334400123 },
          amount: { type: 'integer', example: 10000000 },
          checkoutUrl: {
            type: 'string',
            format: 'uri',
            description: 'Mở URL này trên trình duyệt để thanh toán PayOS',
          },
          paymentLinkId: { type: 'string', nullable: true },
          returnUrl: { type: 'string', format: 'uri' },
          cancelUrl: { type: 'string', format: 'uri' },
          invoiceId: uuid,
          contractId: uuid,
          reusedExistingLink: {
            type: 'boolean',
            description:
              'true khi trả lại link PayOS đã tạo (bấm lại nút thanh toán, không tạo order mới)',
          },
        },
      },
      ContractTerminationPreview: {
        type: 'object',
        properties: {
          contractId: uuid,
          contractStatus: { type: 'string' },
          billingCycle: { type: 'string', enum: ['MONTHLY', 'YEARLY'] },
          hasInbound: { type: 'boolean' },
          totalPaid: { type: 'number' },
          monthlyRate: { type: 'number' },
          contractMonths: { type: 'integer' },
          usedMonths: { type: 'integer' },
          unusedMonths: { type: 'integer' },
          processingFee: { type: 'number' },
          terminationFee: { type: 'number' },
          refundAmount: { type: 'number' },
          processingRatePercent: { type: 'number', nullable: true },
        },
      },
      ContractTerminationRequestCreate: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Lý do chấm dứt (optional)' },
        },
        example: {
          reason: 'Ngừng kinh doanh mùa hè',
        },
      },
      ContractTerminationRequestRow: {
        type: 'object',
        properties: {
          terminationRequestId: uuid,
          contractId: uuid,
          tenantId: uuid,
          status: {
            type: 'string',
            enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
          },
          billingCycle: { type: 'string' },
          hasInbound: { type: 'boolean' },
          refundAmount: { type: 'number' },
          reason: { type: 'string', nullable: true },
          reviewedBy: { ...uuid, nullable: true },
          reviewedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ContractTerminationInventoryRemainder: {
        type: 'object',
        properties: {
          totalQuantity: { type: 'integer', description: 'Tổng quantity tồn AVAILABLE còn trong kho' },
          availableQuantity: { type: 'integer' },
          reservedQuantity: { type: 'integer' },
          skuCount: { type: 'integer', description: 'Số SKU còn quantity > 0' },
        },
      },
      ContractTerminationApproveResult: {
        type: 'object',
        properties: {
          request: { $ref: '#/components/schemas/ContractTerminationRequestRow' },
          contract: { type: 'object' },
          inventoryRemainder: {
            $ref: '#/components/schemas/ContractTerminationInventoryRemainder',
          },
          nextSteps: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              outboundAllowed: { type: 'boolean' },
              inboundAllowed: { type: 'boolean' },
            },
          },
        },
      },
      PayOSWebhookPing: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
          path: { type: 'string', example: '/api/payos/webhook' },
        },
      },

      ContractItem: {
        type: 'object',
        properties: {
          contractItemId: uuid,
          contractId: uuid,
          itemType: {
            type: 'string',
            enum: ['STORAGE', 'INBOUND', 'OUTBOUND', 'HANDLING', 'REPACKING', 'SLA'],
          },
          storageLevel: {
            type: 'string',
            enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
            nullable: true,
          },
          billingUnit: {
            type: 'string',
            enum: [
              'BOX_DAY',
              'BIN_DAY',
              'RACK_DAY',
              'ZONE_DAY',
              'WAREHOUSE_DAY',
              'INBOUND_LPN',
              'OUTBOUND_LPN',
              'HANDLING_UNIT',
            ],
          },
          quantity: { type: 'number', nullable: true },
          reservedQuantity: { type: 'integer', nullable: true },
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
            nullable: true,
          },
          unitPrice: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ContractItemCreate: {
        type: 'object',
        required: ['contractId', 'itemType', 'billingUnit', 'unitPrice'],
        properties: {
          contractId: uuid,
          itemType: {
            type: 'string',
            enum: ['STORAGE', 'INBOUND', 'OUTBOUND', 'HANDLING', 'REPACKING', 'SLA'],
          },
          storageLevel: {
            type: 'string',
            enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
          },
          billingUnit: {
            type: 'string',
            enum: [
              'BOX_DAY',
              'BIN_DAY',
              'RACK_DAY',
              'ZONE_DAY',
              'WAREHOUSE_DAY',
              'INBOUND_LPN',
              'OUTBOUND_LPN',
              'HANDLING_UNIT',
            ],
          },
          quantity: { type: 'number', minimum: 0 },
          reservedQuantity: { type: 'integer', minimum: 0 },
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          unitPrice: { type: 'number', minimum: 0 },
        },
      },
      ContractItemUpdate: {
        type: 'object',
        properties: {
          itemType: {
            type: 'string',
            enum: ['STORAGE', 'INBOUND', 'OUTBOUND', 'HANDLING', 'REPACKING', 'SLA'],
          },
          storageLevel: {
            type: 'string',
            enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
          },
          billingUnit: {
            type: 'string',
            enum: [
              'BOX_DAY',
              'BIN_DAY',
              'RACK_DAY',
              'ZONE_DAY',
              'WAREHOUSE_DAY',
              'INBOUND_LPN',
              'OUTBOUND_LPN',
              'HANDLING_UNIT',
            ],
          },
          quantity: { type: 'number', minimum: 0 },
          reservedQuantity: { type: 'integer', minimum: 0 },
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          unitPrice: { type: 'number', minimum: 0 },
        },
      },

      StorageReservation: {
        type: 'object',
        properties: {
          reservationId: uuid,
          contractId: uuid,
          tenantId: uuid,
          reservationType: {
            type: 'string',
            enum: ['SHARED', 'RESERVED', 'DEDICATED'],
          },
          storageLevel: {
            type: 'string',
            enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
          },
          warehouseId: uuid,
          zoneId: { ...uuid, nullable: true },
          rackId: { ...uuid, nullable: true },
          rackLevelId: { ...uuid, nullable: true },
          binId: { ...uuid, nullable: true },
          reservedCapacity: { type: 'number', nullable: true },
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
            nullable: true,
          },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
          },
          ...timestamps,
        },
      },
      StorageReservationCreate: {
        type: 'object',
        required: [
          'contractId',
          'reservationType',
          'storageLevel',
          'warehouseId',
          'startDate',
          'endDate',
        ],
        description:
          'Tenant inherited from contract.tenantId. FK target depends on storageLevel: ZONE→zoneId, RACK→rackId, RACK_LEVEL→rackLevelId, BIN→binId.',
        properties: {
          contractId: uuid,
          reservationType: {
            type: 'string',
            enum: ['SHARED', 'RESERVED', 'DEDICATED'],
          },
          storageLevel: {
            type: 'string',
            enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
          },
          warehouseId: uuid,
          zoneId: uuid,
          rackId: uuid,
          rackLevelId: uuid,
          binId: uuid,
          reservedCapacity: { type: 'number', minimum: 0 },
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
            default: 'ACTIVE',
          },
        },
      },
      StorageReservationUpdate: {
        type: 'object',
        properties: {
          reservationType: {
            type: 'string',
            enum: ['SHARED', 'RESERVED', 'DEDICATED'],
          },
          reservedCapacity: { type: 'number', minimum: 0 },
          boxType: {
            type: 'string',
            enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'],
          },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
          },
        },
      },

      TenantCompany: {
        type: 'object',
        properties: {
          tenantId: uuid,
          companyName: { type: 'string', example: 'ABC Fashion JSC' },
          companyCode: { type: 'string', nullable: true },
          taxCode: { type: 'string', nullable: true },
          contactName: { type: 'string', nullable: true },
          contactEmail: { type: 'string', nullable: true },
          contactPhone: { type: 'string', nullable: true },
          address: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
          ...timestamps,
        },
      },
      TenantCompanyCreate: {
        type: 'object',
        description:
          'Flow 1 bước 1 — guest tạo hồ sơ công ty trước khi gửi rental request. Required fields: `companyName`.',
        required: ['companyName'],
        properties: {
          companyName: { type: 'string' },
          companyCode: { type: 'string' },
          taxCode: { type: 'string' },
          contactName: { type: 'string' },
          contactEmail: { type: 'string', format: 'email' },
          contactPhone: { type: 'string' },
          address: { type: 'string' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'SUSPENDED'],
            default: 'ACTIVE',
          },
        },
      },
      TenantCompanyUpdate: {
        type: 'object',
        properties: {
          companyName: { type: 'string' },
          companyCode: { type: 'string' },
          taxCode: { type: 'string' },
          contactName: { type: 'string' },
          contactEmail: { type: 'string', format: 'email' },
          contactPhone: { type: 'string' },
          address: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
        },
      },

      RentalRequestUpdate: {
        type: 'object',
        description:
          'Workflow review:\n' +
          '- UNDER_REVIEW: `{ status, reviewedBy }`\n' +
          '- APPROVE + claim (first wins): `{ status: APPROVED, warehouseId, reviewedBy, reviewedAt?, reviewNote? }`\n' +
          '- REJECT: `{ status: REJECTED, reviewedBy, rejectionReason }`\n' +
          '- CONVERTED: sau khi tạo contract\n' +
          'Cập nhật `productLines` chỉ khi `status` là `PENDING` hoặc `UNDER_REVIEW` (thay thế toàn bộ dòng).\n' +
          'Cập nhật thông tin công ty qua `PATCH /tenants/{tenantId}`.',
        properties: {
          contractType: {
            type: 'string',
            enum: [
              'SHARED_STORAGE',
              'RESERVED_STORAGE',
              'DEDICATED_ZONE',
              'DEDICATED_WAREHOUSE',
            ],
          },
          pricingModel: {
            type: 'string',
            enum: ['USAGE_BASED', 'FIXED', 'HYBRID'],
          },
          billingCycle: {
            type: 'string',
            enum: ['DAILY', 'MONTHLY', 'QUARTERLY', 'YEARLY'],
          },
          productLines: {
            type: 'array',
            items: { $ref: '#/components/schemas/RentalRequestProductLineInput' },
          },
          estimatedSkuCount: { type: 'integer', minimum: 0 },
          estimatedBoxCount: { type: 'integer', minimum: 0 },
          estimatedVolume: { type: 'number', minimum: 0 },
          requestedAreaM2: {
            type: 'number',
            minimum: 0,
            description: 'Diện tích mong muốn (m²) — thuê nguyên kho / zone',
          },
          averageStorageDays: { type: 'integer', minimum: 0 },
          estimatedInboundPerWeek: { type: 'integer', minimum: 0 },
          estimatedOutboundPerWeek: { type: 'integer', minimum: 0 },
          requiresFastPicking: { type: 'boolean' },
          requiresPremiumStorage: { type: 'boolean' },
          notes: { type: 'string' },
          suggestedZoneType: {
            type: 'string',
            enum: ['SHARED', 'FAST_MOVING', 'PREMIUM', 'PRIVATE'],
          },
          suggestedRackType: {
            type: 'string',
            enum: ['STANDARD'],
          },
          expectedStartDate: { type: 'string', format: 'date-time' },
          expectedEndDate: { type: 'string', format: 'date-time' },
          status: {
            type: 'string',
            enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED'],
          },
          reviewedBy: uuid,
          reviewedAt: { type: 'string', format: 'date-time' },
          rejectionReason: { type: 'string' },
          reviewNote: { type: 'string' },
          warehouseId: {
            ...uuid,
            description:
              'Required when status=APPROVED — claims the request for this warehouse (first approve wins).',
          },
        },
      },
    },
    parameters: {
      page: {
        in: 'query',
        name: 'page',
        schema: { type: 'integer', minimum: 1, default: 1 },
      },
      limit: {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
    },
  },
  paths: {
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        description: 'Returns JWT access token. Use header `Authorization: Bearer <token>` for protected routes.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/LoginData' }, 'Login successful'),
          400: stdErrors[400],
          401: stdErrors[401],
          403: stdErrors[403],
        },
      },
    },

    '/api/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Quên mật khẩu — gửi OTP về email (không cần đăng nhập)',
        description:
          'Bước 1/2 của flow quên mật khẩu. Nhập email tài khoản → BE sinh OTP 6 số (TTL 10 phút) và gửi tới email đó. Phản hồi luôn 200 để tránh user enumeration (không xác nhận email có tồn tại hay không). Chưa đổi password ở bước này.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ForgotPasswordRequest' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/ForgotPasswordRequestData' },
            'OTP đã được gửi tới email nếu tài khoản tồn tại',
          ),
          400: stdErrors[400],
          502: {
            description: 'Gửi email thất bại',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/auth/forgot-password/verify': {
      post: {
        tags: ['Auth'],
        summary: 'Xác nhận OTP và đặt lại mật khẩu (không cần đăng nhập)',
        description:
          'Bước 2/2. Nhập email + OTP đã nhận + mật khẩu mới. OTP single-use, tối đa 5 lần nhập sai sẽ bị khoá — phải request lại OTP. Mật khẩu mới ≥ 8 ký tự.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ForgotPasswordVerifyRequest' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/ForgotPasswordVerifyData' },
            'Đặt lại mật khẩu thành công',
          ),
          400: stdErrors[400],
          403: stdErrors[403],
        },
      },
    },

    '/api/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Đổi mật khẩu (đã đăng nhập, không cần OTP)',
        security: bearerSecurity,
        description:
          'User đã đăng nhập nhập `currentPassword` + `newPassword`. BE verify mật khẩu cũ rồi cập nhật ngay — không gửi OTP.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ChangePasswordRequest' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/ChangePasswordData' },
            'Đổi mật khẩu thành công',
          ),
          400: stdErrors[400],
          401: stdErrors[401],
          403: stdErrors[403],
        },
      },
    },

    '/api/users/me': {
      get: {
        tags: ['User'],
        summary: 'Current user profile',
        security: bearerSecurity,
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/User' }),
          401: stdErrors[401],
        },
      },
    },
    '/api/users': {
      get: {
        tags: ['User'],
        summary: 'List users (scoped by role)',
        security: bearerSecurity,
        description:
          'SYSTEM_ADMIN: all users. WH_ADMIN: users in same warehouse. TENANT_ADMIN: users in same tenant.',
        parameters: [
          {
            in: 'query',
            name: 'role',
            schema: {
              type: 'string',
              enum: ['SYSTEM_ADMIN', 'WH_ADMIN', 'WH_STAFF', 'TENANT_ADMIN', 'TENANT_STAFF'],
            },
          },
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED'] },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/User' }),
          401: stdErrors[401],
          403: stdErrors[403],
        },
      },
      post: {
        tags: ['User'],
        summary: 'Create user',
        security: bearerSecurity,
        description:
          'SYSTEM_ADMIN → WH_ADMIN (warehouseId), TENANT_ADMIN (tenantId). WH_ADMIN → WH_STAFF. TENANT_ADMIN → TENANT_STAFF.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UserCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope({ $ref: '#/components/schemas/User' }, 'Created successfully'),
          400: stdErrors[400],
          401: stdErrors[401],
          403: stdErrors[403],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/users/{userId}': {
      get: {
        tags: ['User'],
        summary: 'Get user by ID',
        security: bearerSecurity,
        parameters: [{ in: 'path', name: 'userId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/User' }),
          401: stdErrors[401],
          403: stdErrors[403],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['User'],
        summary: 'Update user',
        security: bearerSecurity,
        parameters: [{ in: 'path', name: 'userId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UserUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/User' }, 'Updated successfully'),
          400: stdErrors[400],
          401: stdErrors[401],
          403: stdErrors[403],
          404: stdErrors[404],
        },
      },
    },

    '/api/scan/resolve': {
      get: {
        tags: ['Scan'],
        summary: 'Resolve scanned Code128 value',
        description:
          'Mobile WH: sau khi quét Code128, gửi chuỗi đọc được (`value`).\n\n' +
          '- Auto-detect: `INB-*` inbound, `OUT-*` outbound, `BATCH-*` batch (response kèm `lpns[]`)\n' +
          '- Hoặc mã LPN / SKU / bin trong phạm vi `warehouseId` (WH staff lấy từ JWT)\n' +
          '- Hoặc `NGW1|INBOUND|INB-…` / `NGW1|LPN|…` (typed)\n\n' +
          'In tem: encode field `value` (symbology **Code 128**).',
        parameters: [
          {
            in: 'query',
            name: 'value',
            required: true,
            schema: { type: 'string' },
            description: 'Chuỗi đọc từ scanner (business code hoặc NGW1)',
          },
          {
            in: 'query',
            name: 'warehouseId',
            schema: uuid,
            description: 'Optional for SYSTEM_ADMIN; WH roles dùng warehouse gắn account',
          },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/BarcodeScanResult' }),
          400: stdErrors[400],
          401: stdErrors[401],
          403: stdErrors[403],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
      post: {
        tags: ['Scan'],
        summary: 'Resolve scanned Code128 value (POST body)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['value'],
                properties: {
                  value: { type: 'string' },
                  warehouseId: uuid,
                },
              },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/BarcodeScanResult' }),
          400: stdErrors[400],
          401: stdErrors[401],
          403: stdErrors[403],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },

    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Verifies API and PostgreSQL connectivity.',
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/HealthData' }, 'Service healthy'),
          503: {
            description: 'Database unavailable',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },

    '/api/warehouses': {
      get: {
        tags: ['Warehouse'],
        summary: 'List warehouses',
        parameters: [
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'CLOSED'],
            },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/Warehouse' }),
          400: stdErrors[400],
        },
      },
      post: {
        tags: ['Warehouse'],
        summary: 'Create warehouse',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WarehouseCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/Warehouse' },
            'Warehouse created'
          ),
          400: stdErrors[400],
          409: stdErrors[409],
        },
      },
    },
    '/api/warehouses/{warehouseId}/inbound-requests': {
      get: {
        tags: ['Warehouse', 'InboundRequest'],
        summary: 'List inbound requests for a warehouse',
        description: '**Flow 3** — inbox WH theo `warehouseId` + lọc `status`/`tenantId`.',
        parameters: [
          { in: 'path', name: 'warehouseId', required: true, schema: uuid },
          { in: 'query', name: 'tenantId', schema: uuid },
          { in: 'query', name: 'contractId', schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: [
                'DRAFT',
                'PENDING',
                'APPROVED',
                'ARRIVED',
                'RECEIVING',
                'COMPLETED',
                'CANCELLED',
              ],
            },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/InboundRequest' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/warehouses/{warehouseId}/rental-requests': {
      get: {
        tags: ['Warehouse', 'RentalRequest'],
        summary: 'Warehouse regional inbox (unclaimed rental requests)',
        description:
          'Default `regionMatch=true`: PENDING/unclaimed requests matching warehouse `city` + `district`. ' +
          'Equivalent: `GET /rental-requests?warehouseId={id}&regionMatch=true`.',
        parameters: [
          { in: 'path', name: 'warehouseId', required: true, schema: uuid },
          { in: 'query', name: 'tenantId', schema: uuid },
          {
            in: 'query',
            name: 'regionMatch',
            schema: { type: 'boolean', default: true },
            description: 'Default true — unclaimed requests in same city/district as warehouse.',
          },
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED'],
            },
          },
          {
            in: 'query',
            name: 'contractType',
            schema: {
              type: 'string',
              enum: [
                'SHARED_STORAGE',
                'RESERVED_STORAGE',
                'DEDICATED_ZONE',
                'DEDICATED_WAREHOUSE',
              ],
            },
          },
          {
            in: 'query',
            name: 'pricingModel',
            schema: { type: 'string', enum: ['USAGE_BASED', 'FIXED', 'HYBRID'] },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/RentalRequest' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/warehouses/{warehouseId}': {
      get: {
        tags: ['Warehouse'],
        summary: 'Get warehouse by ID',
        parameters: [
          { in: 'path', name: 'warehouseId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Warehouse' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['Warehouse'],
        summary: 'Update warehouse',
        parameters: [
          { in: 'path', name: 'warehouseId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WarehouseUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/Warehouse' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['Warehouse'],
        summary: 'Delete warehouse',
        parameters: [
          { in: 'path', name: 'warehouseId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/Warehouse' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/zones': {
      get: {
        tags: ['Zone'],
        summary: 'List zones',
        parameters: [
          { in: 'query', name: 'warehouseId', required: true, schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
          },
          {
            in: 'query',
            name: 'zoneType',
            schema: {
              type: 'string',
              enum: ['SHARED', 'FAST_MOVING', 'PREMIUM', 'PRIVATE'],
            },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/WarehouseZone' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['Zone'],
        summary: 'Create zone',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ZoneCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/WarehouseZone' },
            'Zone created'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/zones/{zoneId}': {
      get: {
        tags: ['Zone'],
        summary: 'Get zone by ID',
        parameters: [{ in: 'path', name: 'zoneId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/WarehouseZone' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['Zone'],
        summary: 'Update zone',
        parameters: [{ in: 'path', name: 'zoneId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ZoneUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/WarehouseZone' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['Zone'],
        summary: 'Delete zone',
        parameters: [{ in: 'path', name: 'zoneId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/WarehouseZone' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/racks': {
      get: {
        tags: ['Rack'],
        summary: 'List racks',
        parameters: [
          { in: 'query', name: 'zoneId', required: true, schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string', enum: ['ACTIVE', 'BLOCKED'] },
          },
          {
            in: 'query',
            name: 'rackType',
            schema: { type: 'string', enum: ['STANDARD'] },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/Rack' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['Rack'],
        summary: 'Create rack',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RackCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope({ $ref: '#/components/schemas/Rack' }, 'Rack created'),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/racks/{rackId}': {
      get: {
        tags: ['Rack'],
        summary: 'Get rack by ID',
        parameters: [{ in: 'path', name: 'rackId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Rack' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['Rack'],
        summary: 'Update rack',
        parameters: [{ in: 'path', name: 'rackId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RackUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Rack' }, 'Updated successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['Rack'],
        summary: 'Delete rack',
        parameters: [{ in: 'path', name: 'rackId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Rack' }, 'Deleted successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/rack-levels': {
      get: {
        tags: ['RackLevel'],
        summary: 'List rack levels',
        parameters: [
          { in: 'query', name: 'rackId', required: true, schema: uuid },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/RackLevel' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['RackLevel'],
        summary: 'Create rack level',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RackLevelCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/RackLevel' },
            'Rack level created'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/rack-levels/{rackLevelId}': {
      get: {
        tags: ['RackLevel'],
        summary: 'Get rack level by ID',
        parameters: [
          { in: 'path', name: 'rackLevelId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/RackLevel' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['RackLevel'],
        summary: 'Update rack level',
        parameters: [
          { in: 'path', name: 'rackLevelId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RackLevelUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/RackLevel' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['RackLevel'],
        summary: 'Delete rack level',
        parameters: [
          { in: 'path', name: 'rackLevelId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/RackLevel' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/bins': {
      get: {
        tags: ['Bin'],
        summary: 'List bins',
        parameters: [
          { in: 'query', name: 'rackLevelId', required: true, schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: ['EMPTY', 'PARTIAL', 'FULL', 'RESERVED', 'BLOCKED'],
            },
          },
          {
            in: 'query',
            name: 'reservationType',
            schema: { type: 'string', enum: ['SHARED', 'RESERVED', 'DEDICATED'] },
          },
          {
            in: 'query',
            name: 'supportedBoxType',
            schema: { type: 'string', enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'] },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/Bin' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['Bin'],
        summary: 'Create bin',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BinCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope({ $ref: '#/components/schemas/Bin' }, 'Bin created'),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/bins/{binId}': {
      get: {
        tags: ['Bin'],
        summary: 'Get bin by ID',
        parameters: [{ in: 'path', name: 'binId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Bin' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['Bin'],
        summary: 'Update bin',
        parameters: [{ in: 'path', name: 'binId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BinUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Bin' }, 'Updated successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['Bin'],
        summary: 'Delete bin',
        parameters: [{ in: 'path', name: 'binId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Bin' }, 'Deleted successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/categories': {
      get: {
        tags: ['Category'],
        summary: 'List categories',
        parameters: [
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/Category' }),
          400: stdErrors[400],
        },
      },
      post: {
        tags: ['Category'],
        summary: 'Create category',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CategoryCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope({ $ref: '#/components/schemas/Category' }, 'Category created'),
          400: stdErrors[400],
          409: stdErrors[409],
        },
      },
    },
    '/api/categories/{categoryId}': {
      get: {
        tags: ['Category'],
        summary: 'Get category by ID',
        parameters: [{ in: 'path', name: 'categoryId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Category' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['Category'],
        summary: 'Update category',
        parameters: [{ in: 'path', name: 'categoryId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CategoryUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Category' }, 'Updated successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
      delete: {
        tags: ['Category'],
        summary: 'Delete category',
        parameters: [{ in: 'path', name: 'categoryId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Category' }, 'Deleted successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/seasons': {
      get: {
        tags: ['Season'],
        summary: 'List seasons',
        parameters: [
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/Season' }),
          400: stdErrors[400],
        },
      },
      post: {
        tags: ['Season'],
        summary: 'Create season',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SeasonCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope({ $ref: '#/components/schemas/Season' }, 'Season created'),
          400: stdErrors[400],
          409: stdErrors[409],
        },
      },
    },
    '/api/seasons/{seasonId}': {
      get: {
        tags: ['Season'],
        summary: 'Get season by ID',
        parameters: [{ in: 'path', name: 'seasonId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Season' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['Season'],
        summary: 'Update season',
        parameters: [{ in: 'path', name: 'seasonId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SeasonUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Season' }, 'Updated successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
      delete: {
        tags: ['Season'],
        summary: 'Delete season',
        parameters: [{ in: 'path', name: 'seasonId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Season' }, 'Deleted successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/collections': {
      get: {
        tags: ['Collection'],
        summary: 'List collections',
        parameters: [
          { in: 'query', name: 'tenantId', required: true, schema: uuid },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/Collection' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['Collection'],
        summary: 'Create collection',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CollectionCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/Collection' },
            'Collection created'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/collections/{collectionId}': {
      get: {
        tags: ['Collection'],
        summary: 'Get collection by ID',
        parameters: [{ in: 'path', name: 'collectionId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Collection' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['Collection'],
        summary: 'Update collection',
        parameters: [{ in: 'path', name: 'collectionId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CollectionUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/Collection' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
      delete: {
        tags: ['Collection'],
        summary: 'Delete collection',
        parameters: [{ in: 'path', name: 'collectionId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/Collection' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/skus': {
      get: {
        tags: ['SKU'],
        summary: 'List SKUs',
        parameters: [
          { in: 'query', name: 'tenantId', required: true, schema: uuid },
          { in: 'query', name: 'status', schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] } },
          {
            in: 'query',
            name: 'movementCategory',
            schema: { type: 'string', enum: ['FAST', 'NORMAL', 'SLOW'] },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/Sku' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['SKU'],
        summary: 'Create SKU',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SkuCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope({ $ref: '#/components/schemas/Sku' }, 'SKU created'),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/skus/{skuId}': {
      get: {
        tags: ['SKU'],
        summary: 'Get SKU by ID',
        parameters: [{ in: 'path', name: 'skuId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Sku' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['SKU'],
        summary: 'Update SKU',
        parameters: [{ in: 'path', name: 'skuId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SkuUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Sku' }, 'Updated successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
      delete: {
        tags: ['SKU'],
        summary: 'Delete SKU',
        parameters: [{ in: 'path', name: 'skuId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Sku' }, 'Deleted successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/inbound-requests': {
      get: {
        tags: ['InboundRequest'],
        summary: 'List inbound requests (filter by tenant, warehouse, contract, status)',
        description:
          '**Flow 3** — lọc `status`, `deliveryMode`; transporter: `assignedToMe=true`. `includeDelivery=true` khi list hỗ trợ.',
        parameters: [
          { in: 'query', name: 'tenantId', schema: uuid },
          {
            in: 'query',
            name: 'warehouseId',
            schema: uuid,
            description:
              'Filter by warehouse; or use GET /api/warehouses/{warehouseId}/inbound-requests',
          },
          { in: 'query', name: 'contractId', schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: [
                'DRAFT',
                'PENDING',
                'APPROVED',
                'ARRIVED',
                'RECEIVING',
                'COMPLETED',
                'CANCELLED',
              ],
            },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/InboundRequest' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['InboundRequest'],
        summary: 'Create inbound request (contract must be ACTIVE)',
        description:
          '**Flow 3 bước 1.** `TENANT_ADMIN`, `TENANT_STAFF` only (`WH_ADMIN` → 403). HĐ ACTIVE. `deliveryMode` default `TENANT_SELF`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InboundRequestCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/InboundRequest' },
            'Inbound request created'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/inbound-requests/{inboundRequestId}/items': {
      get: {
        tags: ['InboundRequest', 'InboundRequestItem'],
        summary: 'List line items on an inbound request',
        parameters: [
          { in: 'path', name: 'inboundRequestId', required: true, schema: uuid },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/InboundRequestItem' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['InboundRequest', 'InboundRequestItem'],
        summary: 'Add SKU line to inbound request',
        description: '**Flow 3 bước 2** — khi inbound `DRAFT`/`PENDING`.',
        parameters: [
          { in: 'path', name: 'inboundRequestId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InboundRequestItemCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/InboundRequestItem' },
            'Inbound request item created'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/inbound-requests/{inboundRequestId}/start-receiving': {
      post: {
        tags: ['InboundRequest'],
        summary: 'Start receiving (ARRIVED → RECEIVING)',
        description: '**Flow 3 bước 9.** Body tuỳ chọn `receivedBy`.',
        parameters: [
          { in: 'path', name: 'inboundRequestId', required: true, schema: uuid },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InboundStartReceiving' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/InboundRequest' },
            'Receiving started'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/inbound-requests/{inboundRequestId}/complete-receiving': {
      post: {
        tags: ['InboundRequest'],
        summary: 'Record received quantities (QC / count)',
        description:
          '**Flow 3 bước 10.** `items[]` + `receivedQuantity`, hoặc PATCH từng dòng rồi POST body rỗng. Inbound vẫn `RECEIVING`.',
        parameters: [
          { in: 'path', name: 'inboundRequestId', required: true, schema: uuid },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InboundCompleteReceiving' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/InboundCompleteReceivingResult' },
            'Receiving quantities recorded'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/inbound-requests/{inboundRequestId}/complete': {
      post: {
        tags: ['InboundRequest'],
        summary: 'Complete inbound (all LPNs must be STORED)',
        description:
          '**Flow 3 bước 14.** Cần ≥1 batch, ≥1 LPN, mọi LPN `STORED`. `RECEIVING` → `COMPLETED`.',
        parameters: [
          { in: 'path', name: 'inboundRequestId', required: true, schema: uuid },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InboundStartReceiving' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/InboundRequest' },
            'Inbound completed'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/inbound-request-items': {
      get: {
        tags: ['InboundRequestItem'],
        summary: 'List inbound request items',
        parameters: [
          { in: 'query', name: 'inboundRequestId', required: true, schema: uuid },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/InboundRequestItem' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['InboundRequestItem'],
        summary: 'Create inbound request item',
        description: '**Flow 3 bước 2** — body có `inboundRequestId`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InboundRequestItemCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/InboundRequestItem' },
            'Inbound request item created'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/inbound-request-items/{inboundRequestItemId}': {
      get: {
        tags: ['InboundRequestItem'],
        summary: 'Get inbound request item',
        parameters: [
          { in: 'path', name: 'inboundRequestItemId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/InboundRequestItem' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['InboundRequestItem'],
        summary: 'Update inbound request item (e.g. receivedQuantity)',
        description: '**Flow 3 bước 10** — ghi `receivedQuantity` khi inbound `RECEIVING`.',
        parameters: [
          { in: 'path', name: 'inboundRequestItemId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InboundRequestItemUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/InboundRequestItem' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['InboundRequestItem'],
        summary: 'Delete inbound request item',
        parameters: [
          { in: 'path', name: 'inboundRequestItemId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/InboundRequestItem' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/inventories': {
      get: {
        tags: ['Inventory'],
        summary: 'List inventory records',
        description:
          'Flow 4 tiền điều kiện — kiểm `available_quantity` trước `POST /outbound-requests`. Roles: `SYSTEM_ADMIN` (all); WH — `warehouseId`; tenant — `tenantId`.',
        parameters: [
          { in: 'query', name: 'tenantId', schema: uuid },
          { in: 'query', name: 'skuId', schema: uuid },
          { in: 'query', name: 'batchId', schema: uuid },
          { in: 'query', name: 'lpnId', schema: uuid },
          { in: 'query', name: 'binId', schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: ['AVAILABLE', 'RESERVED', 'PICKED', 'DAMAGED', 'IN_TRANSIT', 'SHIPPED'],
            },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/Inventory' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/inventories/{inventoryId}': {
      get: {
        tags: ['Inventory'],
        summary: 'Get inventory by ID',
        description: 'Roles: giống list — theo scope tenant/warehouse của user.',
        parameters: [{ in: 'path', name: 'inventoryId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Inventory' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/inventories/{inventoryId}/movements': {
      get: {
        tags: ['Inventory'],
        summary: 'List movements for an inventory record',
        description: 'Roles: giống GET inventory by ID.',
        parameters: [
          { in: 'path', name: 'inventoryId', required: true, schema: uuid },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/InventoryMovement' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/inbound-requests/{inboundRequestId}': {
      get: {
        tags: ['InboundRequest'],
        summary: 'Get inbound request by ID',
        description: 'Flow 3 — `includeItems=true` · `includeDelivery=true` (xe, tài xế, pickup).',
        parameters: [
          { in: 'path', name: 'inboundRequestId', required: true, schema: uuid },
          {
            in: 'query',
            name: 'includeItems',
            schema: { type: 'boolean' },
            description: 'If true, embed items[] with SKU info',
          },
          {
            in: 'query',
            name: 'includeDelivery',
            schema: { type: 'boolean' },
            description: 'If true, embed delivery record (vehicle, driver, pickup)',
          },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/InboundRequestWithItems' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['InboundRequest'],
        summary: 'Update inbound request (status, arrival dates, approvers)',
        description:
          '**Flow 3 bước 3–4a, 6.** Ví dụ: `{ "status": "PENDING" }`, `{ "status": "APPROVED" }`, `{ "status": "ARRIVED", "actualArrivalAt": "…" }` (chỉ `TENANT_SELF`). `CANCELLED` theo rule.',
        parameters: [
          { in: 'path', name: 'inboundRequestId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InboundRequestUpdate' },
              examples: {
                submit: { summary: 'Flow 3 bước 3 — gửi duyệt', value: { status: 'PENDING' } },
                approve: { summary: 'Flow 3 bước 6 — WH duyệt', value: { status: 'APPROVED' } },
                arrivedSelf: {
                  summary: 'Flow 3 bước 4a — tenant tự vận chuyển',
                  value: { status: 'ARRIVED', actualArrivalAt: '2026-06-15T09:00:00.000Z' },
                },
                cancel: { summary: 'Hủy phiếu', value: { status: 'CANCELLED' } },
              },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/InboundRequest' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['InboundRequest'],
        summary: 'Delete inbound request',
        parameters: [
          { in: 'path', name: 'inboundRequestId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/InboundRequest' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/outbound-requests': {
      get: {
        tags: ['OutboundRequest'],
        operationId: 'listOutboundRequests',
        summary: 'List outbound requests (filter by tenant, warehouse, contract, status)',
        description:
          'Roles: `SYSTEM_ADMIN`, `WH_ADMIN`, `WH_STAFF`, `TENANT_ADMIN`, `TENANT_STAFF` (theo scope).',
        security: bearerSecurity,
        parameters: [
          { in: 'query', name: 'tenantId', schema: uuid },
          { in: 'query', name: 'warehouseId', schema: uuid },
          { in: 'query', name: 'contractId', schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: [
                'DRAFT',
                'PENDING',
                'APPROVED',
                'RESERVED',
                'PICKING',
                'PACKING',
                'SHIPPED',
                'COMPLETED',
                'CANCELLED',
              ],
            },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/OutboundRequest' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['OutboundRequest'],
        operationId: 'createOutboundRequest',
        summary: 'Create outbound request',
        description:
          '**Flow 4 bước 1.** Roles: `TENANT_ADMIN`, `TENANT_STAFF`. HĐ `ACTIVE` (invoice INITIAL PAID) hoặc `TERMINATED`. ≥1 inbound `COMPLETED` + tồn khả dụng (`OUTBOUND_NO_COMPLETED_INBOUND` / `OUTBOUND_NO_INVENTORY`). Gửi `items[]` hoặc thêm sau (bước 2). `PENDING` cần ≥1 dòng.',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OutboundRequestCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/OutboundRequest' },
            'Outbound request created'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/outbound-requests/{outboundRequestId}/picking-tasks': {
      get: {
        tags: ['OutboundRequest'],
        operationId: 'listOutboundPickingTasks',
        summary: 'List picking tasks for an outbound request',
        description:
          '**Flow 4 bước 6.** Sau duyệt (`PATCH` `APPROVED` → phiếu `RESERVED`): picking task + dòng pick (FIFO: inventory, LPN, bin, batch). Roles: WH + tenant đọc phiếu của mình.',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'outboundRequestId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({
            type: 'object',
            properties: {
              outboundRequestId: uuid,
              outboundStatus: { type: 'string' },
              hint: {
                type: 'string',
                nullable: true,
                description: 'Gợi ý khi tasks rỗng (chưa duyệt / chưa reserve)',
              },
              tasks: {
                type: 'array',
                items: { $ref: '#/components/schemas/PickingTask' },
              },
            },
          }),
          400: stdErrors[400],
          401: stdErrors[401],
          403: stdErrors[403],
          404: stdErrors[404],
        },
      },
    },
    '/api/outbound-requests/{outboundRequestId}/items': {
      get: {
        tags: ['OutboundRequest', 'OutboundRequestItem'],
        operationId: 'listOutboundRequestItemsByOutbound',
        summary: 'List line items on an outbound request',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'outboundRequestId', required: true, schema: uuid },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/OutboundRequestItem' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['OutboundRequest', 'OutboundRequestItem'],
        operationId: 'createOutboundRequestItemByOutbound',
        summary: 'Add SKU line to outbound request',
        description: '**Flow 4 bước 2** — chỉ khi phiếu `DRAFT`/`PENDING`.',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'outboundRequestId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OutboundRequestItemCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/OutboundRequestItem' },
            'Outbound request item created'
          ),
          400: stdErrors[400],
          401: stdErrors[401],
          403: stdErrors[403],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/outbound-requests/{outboundRequestId}': {
      get: {
        tags: ['OutboundRequest'],
        operationId: 'getOutboundRequestById',
        summary: 'Get outbound request by ID',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'outboundRequestId', required: true, schema: uuid },
          {
            in: 'query',
            name: 'includeItems',
            schema: { type: 'boolean' },
            description: 'If true, include `items[]` with SKU details',
          },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/OutboundRequestWithItems' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['OutboundRequest'],
        operationId: 'updateOutboundRequest',
        summary: 'Update outbound request (status workflow, ship dates)',
        description:
          '**Flow 4 bước 4–5, 7–10, 11.** Tenant: `CANCELLED` (`DRAFT`/`PENDING`). WH: `APPROVED` (bước 5, `PENDING`→`RESERVED`+pick task) · `RESERVED` (recovery) · `PICKING` (7) · `PACKING` (8) · `SHIPPED` (9, trừ tồn) · `COMPLETED` (10). Có thể sửa `requestedShipDate`/`actualShippedAt` khi chưa ship.',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'outboundRequestId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OutboundRequestUpdate' },
              examples: {
                approve: {
                  summary: 'Flow 4 bước 5 — duyệt (→ RESERVED + picking task)',
                  value: { status: 'APPROVED' },
                },
                picking: { summary: 'Flow 4 bước 7 — bắt đầu pick', value: { status: 'PICKING' } },
                packing: { summary: 'Flow 4 bước 8 — hoàn tất pick', value: { status: 'PACKING' } },
                shipped: { summary: 'Flow 4 bước 9 — xuất kho / trừ tồn', value: { status: 'SHIPPED' } },
                completed: {
                  summary: 'Flow 4 bước 10 — đóng phiếu sau giao',
                  value: { status: 'COMPLETED' },
                },
                cancelTenant: {
                  summary: 'Flow 4 bước 4 — tenant hủy',
                  value: { status: 'CANCELLED' },
                },
              },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/OutboundRequest' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          401: stdErrors[401],
          403: stdErrors[403],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['OutboundRequest'],
        operationId: 'deleteOutboundRequest',
        summary: 'Delete outbound request',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'outboundRequestId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/OutboundRequest' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/outbound-request-items': {
      get: {
        tags: ['OutboundRequestItem'],
        operationId: 'listOutboundRequestItems',
        summary: 'List outbound request items',
        security: bearerSecurity,
        parameters: [
          { in: 'query', name: 'outboundRequestId', required: true, schema: uuid },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/OutboundRequestItem' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['OutboundRequestItem'],
        operationId: 'createOutboundRequestItem',
        summary: 'Create outbound request item',
        description:
          '**Flow 4 bước 2** — body có `outboundRequestId`. Chỉ khi phiếu `DRAFT`/`PENDING`.',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OutboundRequestItemCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/OutboundRequestItem' },
            'Outbound request item created'
          ),
          400: stdErrors[400],
          401: stdErrors[401],
          403: stdErrors[403],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/outbound-request-items/{outboundRequestItemId}': {
      get: {
        tags: ['OutboundRequestItem'],
        operationId: 'getOutboundRequestItem',
        summary: 'Get outbound request item',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'outboundRequestItemId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/OutboundRequestItem' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['OutboundRequestItem'],
        operationId: 'updateOutboundRequestItem',
        summary: 'Update outbound request item (requestedQuantity)',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'outboundRequestItemId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OutboundRequestItemUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/OutboundRequestItem' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          401: stdErrors[401],
          403: stdErrors[403],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['OutboundRequestItem'],
        operationId: 'deleteOutboundRequestItem',
        summary: 'Delete outbound request item',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'outboundRequestItemId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/OutboundRequestItem' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/batches': {
      get: {
        tags: ['Batch'],
        summary: 'List batches',
        parameters: [
          { in: 'query', name: 'inboundRequestId', schema: uuid },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/Batch' }),
          400: stdErrors[400],
        },
      },
      post: {
        tags: ['Batch'],
        summary: 'Create batch',
        description: '**Flow 3 bước 11** — sau khi đếm hàng (`RECEIVING`). `inboundRequestId` + `batchCode`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BatchCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope({ $ref: '#/components/schemas/Batch' }, 'Batch created'),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/batches/{batchId}': {
      get: {
        tags: ['Batch'],
        summary: 'Get batch by ID',
        parameters: [{ in: 'path', name: 'batchId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Batch' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['Batch'],
        summary: 'Update batch',
        parameters: [{ in: 'path', name: 'batchId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BatchUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Batch' }, 'Updated successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['Batch'],
        summary: 'Delete batch',
        parameters: [{ in: 'path', name: 'batchId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Batch' }, 'Deleted successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/lpns': {
      get: {
        tags: ['LPN'],
        summary: 'List LPNs',
        parameters: [
          { in: 'query', name: 'tenantId', schema: uuid },
          { in: 'query', name: 'batchId', schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: ['RECEIVING', 'STORED', 'PICKED', 'SHIPPED', 'DAMAGED'],
            },
          },
          {
            in: 'query',
            name: 'boxType',
            schema: { type: 'string', enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'] },
          },
          { in: 'query', name: 'currentBinId', schema: uuid },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/Lpn' }),
          400: stdErrors[400],
        },
      },
      post: {
        tags: ['LPN'],
        summary: 'Create LPN (carton after receiving)',
        description:
          '**Flow 3 bước 12** — `batchId` từ bước 11, status `RECEIVING`. `weightKg` cho rack-suggestion (Flow 5).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LpnCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope({ $ref: '#/components/schemas/Lpn' }, 'LPN created'),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/ai/slot-recommendations/ollama/health': {
      get: {
        tags: ['AI'],
        summary: 'Check Ollama connection and model availability',
        description:
          '**Flow 5 bước 1** (tuỳ chọn). Default http://127.0.0.1:11434, model `llama3.2:3b` (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`). Explain: `llmProvider=ollama`.',
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/OllamaHealth' }),
        },
      },
    },
    '/api/ai/slot-recommendations/gemini/health': {
      get: {
        tags: ['AI'],
        summary: 'Check Gemini API key and model availability',
        description:
          '**Flow 5 bước 1** (tuỳ chọn). Cần `GEMINI_API_KEY`. Model mặc định `gemini-2.0-flash`. Explain: `llmProvider=gemini`.',
        responses: {
          200: successEnvelope({
            type: 'object',
            properties: {
              reachable: { type: 'boolean' },
              enabled: { type: 'boolean' },
              model: { type: 'string' },
              message: { type: 'string' },
            },
          }),
        },
      },
    },
    '/api/ai/slot-recommendations/explain': {
      post: {
        tags: ['AI'],
        summary: 'Explain slot recommendation (Gemini or Ollama only)',
        description:
          '**Flow 5 bước 4.** Tách khỏi preview/create. `llmProvider` bắt buộc (`gemini`|`ollama`). Nguồn: `recommendationId` · `lpnId`+`warehouseId` · object `slot` từ preview. `503` nếu provider down — preview/rule vẫn chạy độc lập.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AiSlotExplainRequest' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/AiSlotLlmExplanation' },
            'Explanation generated'
          ),
          400: stdErrors[400],
          503: stdErrors[503],
        },
      },
    },
    '/api/ai/slot-recommendations/preview': {
      post: {
        tags: ['AI'],
        summary: 'Preview putaway slot recommendation (rule engine only, no LLM)',
        description:
          '**Flow 5 bước 3.** Body: `lpnId`, `warehouseId`, `inboundRequestId?`. Trả top bin + `alternatives` + `reasons`/`featureSnapshot`. Không lưu DB. Không dùng `explainWithLlm` — gọi `POST …/explain`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AiSlotRecommendationCreate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/AiSlotRecommendationPreview' },
            'Slot recommendation preview'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/ai/slot-recommendations': {
      post: {
        tags: ['AI'],
        summary: 'Create and persist top putaway slot recommendation',
        description:
          '**Flow 5 bước 5.** Rule engine (`freeCapacity`, tenant reservation, same-SKU cluster, rack type) → lưu `ai_slot_recommendations`. Tiếp: putaway bước 6.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AiSlotRecommendationCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/AiSlotRecommendation' },
            'Slot recommendation created'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      get: {
        tags: ['AI'],
        summary: 'List AI slot recommendations',
        description: '**Flow 5 bước 8** — lọc `lpnId`, `inboundRequestId`, `isApplied`.',
        parameters: [
          { in: 'query', name: 'lpnId', schema: uuid },
          { in: 'query', name: 'inboundRequestId', schema: uuid },
          { in: 'query', name: 'isApplied', schema: { type: 'boolean' } },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/AiSlotRecommendation' }),
          400: stdErrors[400],
        },
      },
    },
    '/api/ai/slot-recommendations/{recommendationId}/explain': {
      get: {
        tags: ['AI'],
        summary: 'Explain saved recommendation (Gemini or Ollama)',
        description:
          '**Flow 5 bước 4** (đã lưu). Query `llmProvider=gemini|ollama` (bắt buộc). Khuyến nghị `POST /explain` cho tích hợp mới.',
        parameters: [
          { in: 'path', name: 'recommendationId', required: true, schema: uuid },
          {
            in: 'query',
            name: 'llmProvider',
            required: true,
            schema: { type: 'string', enum: ['gemini', 'ollama'] },
          },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/AiSlotLlmExplanation' },
            'Slot recommendation explained'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
          503: stdErrors[503],
        },
      },
    },
    '/api/ai/slot-recommendations/{recommendationId}': {
      get: {
        tags: ['AI'],
        summary: 'Get AI slot recommendation by ID',
        description: 'Flow 5 — chi tiết bản ghi đã lưu (`parsedReason`, `alternatives` nếu có).',
        parameters: [
          { in: 'path', name: 'recommendationId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/AiSlotRecommendation' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['AI'],
        summary: 'Update recommendation (e.g. mark applied after putaway)',
        description:
          '**Flow 5 bước 7** — `{ "isApplied": true|false }`. Putaway bước 6 cũng tự cập nhật khi `recommendationId` + bin khớp gợi ý.',
        parameters: [
          { in: 'path', name: 'recommendationId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AiSlotRecommendationUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/AiSlotRecommendation' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/lpns/{lpnId}/putaway': {
      post: {
        tags: ['LPN', 'Inventory', 'AI'],
        summary: 'Putaway LPN to bin (creates inventory + PUTAWAY movement)',
        description:
          '**Flow 5 bước 6** (kết Flow 3). LPN `RECEIVING`, có `lpn-details`. Body: `binId`, `recommendationId?` → inventory + movement `PUTAWAY`, LPN `STORED`; đánh dấu AI `isApplied` nếu bin trùng gợi ý. Ưu tiên hơn `PATCH` `currentBinId`.',
        parameters: [{ in: 'path', name: 'lpnId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LpnPutawayRequest' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/LpnPutawayResult' },
            'Putaway completed'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/lpns/{lpnId}/rack-suggestion': {
      get: {
        tags: ['LPN'],
        summary: 'Suggest rack type and suitable levels from LPN weight',
        description:
          '**Flow 5 bước 2** (bổ trợ, không thay `POST /ai/slot-recommendations`). `weightKg` vs ngưỡng 25 kg (`LPN_HIGH_CAPACITY_WEIGHT_KG`). Có `warehouseId` → `suitableRackLevels[]`.',
        parameters: [
          { in: 'path', name: 'lpnId', required: true, schema: uuid },
          { in: 'query', name: 'warehouseId', schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/LpnRackSuggestion' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/lpns/{lpnId}/details': {
      get: {
        tags: ['LPN'],
        summary: 'Get LPN with SKU details',
        description:
          'Returns the LPN and all lpn_details lines (skuCode, productName, quantity).',
        parameters: [{ in: 'path', name: 'lpnId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/LpnWithDetails' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/lpn-details': {
      get: {
        tags: ['LPNDetail'],
        summary: 'List SKU lines in an LPN',
        parameters: [
          { in: 'query', name: 'lpnId', required: true, schema: uuid },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/LpnDetail' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['LPNDetail'],
        summary: 'Add SKU to LPN',
        description:
          '**Flow 3 bước 12** — một SKU/LPN (trùng → 409). Cập nhật `actualQuantity`/`fillPercentage` trên LPN.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LpnDetailCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope({ $ref: '#/components/schemas/LpnDetail' }, 'LPN detail created'),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/lpn-details/{lpnDetailId}': {
      get: {
        tags: ['LPNDetail'],
        summary: 'Get LPN detail by ID',
        parameters: [{ in: 'path', name: 'lpnDetailId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/LpnDetail' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['LPNDetail'],
        summary: 'Update quantity in LPN',
        parameters: [{ in: 'path', name: 'lpnDetailId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LpnDetailUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/LpnDetail' }, 'Updated successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['LPNDetail'],
        summary: 'Remove SKU from LPN',
        parameters: [{ in: 'path', name: 'lpnDetailId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/LpnDetail' }, 'Deleted successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/lpns/{lpnId}': {
      get: {
        tags: ['LPN'],
        summary: 'Get LPN by ID',
        parameters: [{ in: 'path', name: 'lpnId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Lpn' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['LPN'],
        summary: 'Update LPN',
        parameters: [{ in: 'path', name: 'lpnId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LpnUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Lpn' }, 'Updated successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['LPN'],
        summary: 'Delete LPN',
        parameters: [{ in: 'path', name: 'lpnId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Lpn' }, 'Deleted successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/rental-requests/guest/lookup': {
      get: {
        tags: ['RentalRequest'],
        summary: 'Lookup rental request by code (guest)',
        description:
          'Public tra cứu trạng thái yêu cầu thuê bằng `requestCode` + `contactEmail` đã đăng ký. Không cần đăng nhập. Trả 404 chung nếu mã hoặc email không khớp.',
        parameters: [
          {
            in: 'query',
            name: 'code',
            required: true,
            schema: { type: 'string', example: 'RR-M5ABC-01' },
          },
          {
            in: 'query',
            name: 'email',
            required: true,
            schema: { type: 'string', format: 'email', example: 'contact@company.com' },
            description: 'Email liên hệ khi tạo tenant (`POST /tenants`)',
          },
        ],
        responses: {
          200: successEnvelope({
            type: 'object',
            properties: {
              requestCode: { type: 'string' },
              status: {
                type: 'string',
                enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED'],
              },
              companyName: { type: 'string' },
              city: { type: 'string' },
              district: { type: 'string' },
              contractType: { type: 'string', nullable: true },
              pricingModel: { type: 'string', nullable: true },
              billingCycle: { type: 'string', nullable: true },
              warehouseName: { type: 'string', nullable: true },
              rejectionReason: { type: 'string', nullable: true },
              createdAt: { type: 'string', format: 'date-time', nullable: true },
              reviewedAt: { type: 'string', format: 'date-time', nullable: true },
            },
          }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/rental-requests': {
      get: {
        tags: ['RentalRequest'],
        summary: 'List rental requests',
        description:
          'Roles: `SYSTEM_ADMIN`, `WH_ADMIN`, `TENANT_ADMIN`, `TENANT_STAFF`.\n' +
          'Query filters:\n' +
          '- `warehouseId` + `regionMatch=true` — inbox kho: yêu cầu **chưa claim** cùng city/district\n' +
          '- `warehouseId` (không regionMatch) — yêu cầu **đã gán** cho kho đó\n' +
          '- `city`, `district`, `tenantId`, `status`, `contractType`, `pricingModel`\n' +
          '- `includeProductLines=true` — kèm mảng `productLines` + `boxAllocation` mỗi item',
        parameters: [
          {
            in: 'query',
            name: 'tenantId',
            schema: uuid,
          },
          {
            in: 'query',
            name: 'includeProductLines',
            schema: { type: 'boolean', default: false },
            description: 'Embed product lines and box allocation per rental request',
          },
          {
            in: 'query',
            name: 'warehouseId',
            schema: uuid,
            description: 'Filter by warehouse; or use GET /api/warehouses/{warehouseId}/rental-requests',
          },
          {
            in: 'query',
            name: 'regionMatch',
            schema: { type: 'boolean', default: false },
            description:
              'With warehouseId: list unclaimed requests matching that warehouse city/district.',
          },
          { in: 'query', name: 'city', schema: { type: 'string' } },
          { in: 'query', name: 'district', schema: { type: 'string' } },
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED'],
            },
          },
          {
            in: 'query',
            name: 'contractType',
            schema: {
              type: 'string',
              enum: [
                'SHARED_STORAGE',
                'RESERVED_STORAGE',
                'DEDICATED_ZONE',
                'DEDICATED_WAREHOUSE',
              ],
            },
          },
          {
            in: 'query',
            name: 'pricingModel',
            schema: { type: 'string', enum: ['USAGE_BASED', 'FIXED', 'HYBRID'] },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/RentalRequest' }),
          400: stdErrors[400],
        },
      },
      post: {
        tags: ['RentalRequest'],
        summary: 'Create rental request (guest — by region)',
        description:
          'Requires existing tenant (`POST /tenants`). Body: `tenantId`, `city`, `district` + thông tin thuê.\n\n' +
          '**Quy mô hàng hóa**: `productLines[]` với `productKind`, `size?`, `quantity` (cái/tháng). Catalog: `GET /api/product-kinds`.\n\n' +
          'Cần ít nhất một: `productLines`, `requestedAreaM2`, hoặc ước tính volume/box/sku.\n\n' +
          'Public: guest không cần token; Bearer token → `createdBy` = user hiện tại.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RentalRequestCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/RentalRequest' },
            'Rental request created'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/tenants': {
      get: {
        tags: ['TenantCompany'],
        summary: 'List tenant companies',
        parameters: [
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/TenantCompany' }),
          400: stdErrors[400],
        },
      },
      post: {
        tags: ['TenantCompany'],
        summary: 'Create tenant company (guest onboarding step 1)',
        description: 'Public — no auth. Guest creates company profile before rental request.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TenantCompanyCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/TenantCompany' },
            'Tenant company created'
          ),
          400: stdErrors[400],
          409: stdErrors[409],
        },
      },
    },
    '/api/tenants/{tenantId}': {
      get: {
        tags: ['TenantCompany'],
        summary: 'Get tenant company by ID',
        parameters: [{ in: 'path', name: 'tenantId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/TenantCompany' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['TenantCompany'],
        summary: 'Update tenant company',
        parameters: [{ in: 'path', name: 'tenantId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TenantCompanyUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/TenantCompany' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['TenantCompany'],
        summary: 'Delete tenant company',
        parameters: [{ in: 'path', name: 'tenantId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/TenantCompany' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/rental-requests/{rentalRequestId}': {
      get: {
        tags: ['RentalRequest'],
        summary: 'Get rental request by ID',
        description: 'Response includes `productLines`, `boxAllocation`, `totalCommittedVolumeUnits`.',
        parameters: [
          { in: 'path', name: 'rentalRequestId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/RentalRequest' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['RentalRequest'],
        summary: 'Update rental request / approve & claim warehouse',
        description:
          'Unclaimed request: only `APPROVED` (with `warehouseId`) or `REJECTED`. ' +
          'Approve sets `warehouseId` atomically — other warehouses get 409 ALREADY_CLAIMED.',
        parameters: [
          { in: 'path', name: 'rentalRequestId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RentalRequestUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/RentalRequest' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
      delete: {
        tags: ['RentalRequest'],
        summary: 'Delete rental request',
        parameters: [
          { in: 'path', name: 'rentalRequestId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/RentalRequest' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/contracts': {
      get: {
        tags: ['Contract'],
        summary: 'List contracts',
        parameters: [
          { in: 'query', name: 'tenantId', schema: uuid },
          { in: 'query', name: 'warehouseId', schema: uuid },
          { in: 'query', name: 'rentalRequestId', schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: [
                'DRAFT',
                'PENDING_APPROVAL',
                'PENDING_PAYMENT',
                'ACTIVE',
                'EXPIRED',
                'TERMINATED',
                'CANCELLED',
              ],
            },
          },
          {
            in: 'query',
            name: 'contractType',
            schema: {
              type: 'string',
              enum: [
                'SHARED_STORAGE',
                'RESERVED_STORAGE',
                'DEDICATED_ZONE',
                'DEDICATED_WAREHOUSE',
              ],
            },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/Contract' }),
          400: stdErrors[400],
        },
      },
      post: {
        tags: ['Contract'],
        summary: 'Create contract',
        description:
          'Flow 1 bước 7 — sau `PATCH /rental-requests` APPROVED. Body: `tenantId`, `warehouseId`, `rentalRequestId`, `contractType`, dates… Thường `DRAFT`. Tiếp: storage-reservation → ký WH → tenant ký → thanh toán (tag PayOS).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContractCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope({ $ref: '#/components/schemas/Contract' }, 'Contract created'),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/contracts/{contractId}': {
      get: {
        tags: ['Contract'],
        summary: 'Get contract by ID',
        parameters: [{ in: 'path', name: 'contractId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/Contract' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['Contract'],
        summary: 'Update contract (incl. status, signatures)',
        description:
          'Flow 1: WH bước 9 (`warehouseSignature`, `PENDING_APPROVAL`); tenant bước 11 (`tenantSignature` → `PENDING_PAYMENT` + invoice INITIAL). Không chuyển `ACTIVE` bằng PATCH nếu invoice INITIAL chưa PAID — dùng PayOS / `mark-paid`.',
        parameters: [{ in: 'path', name: 'contractId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContractUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/Contract' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['Contract'],
        summary: 'Delete contract',
        parameters: [{ in: 'path', name: 'contractId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/Contract' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/contracts/{contractId}/appendices/ceiling': {
      get: {
        tags: ['ContractAppendix'],
        summary: 'Trần cấp không gian HĐ gốc',
        description:
          'Phụ lục chỉ thêm cấp ≤ `ceilingLevel`; vượt trần → tạo HĐ mới. Xem `docs/contract-appendix.md`.',
        security: bearerSecurity,
        parameters: [{ in: 'path', name: 'contractId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/ContractAppendixCeiling' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/contracts/{contractId}/appendices': {
      get: {
        tags: ['ContractAppendix'],
        summary: 'Danh sách phụ lục',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: [
                'PENDING',
                'UNDER_REVIEW',
                'REJECTED',
                'PENDING_APPROVAL',
                'PENDING_PAYMENT',
                'ACTIVE',
                'TERMINATED',
                'CANCELLED',
              ],
            },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/ContractAppendix' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['ContractAppendix'],
        summary: 'Tenant gửi yêu cầu phụ lục',
        description: 'Role: **TENANT_ADMIN**. HĐ gốc `ACTIVE`.',
        security: bearerSecurity,
        parameters: [{ in: 'path', name: 'contractId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContractAppendixCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/ContractAppendix' },
            'Appendix request submitted'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/contracts/{contractId}/appendices/{appendixId}': {
      get: {
        tags: ['ContractAppendix'],
        summary: 'Chi tiết phụ lục',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          { in: 'path', name: 'appendixId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/ContractAppendix' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['ContractAppendix'],
        summary: 'Tenant ký phụ lục',
        description: 'Role: **TENANT_ADMIN**. `PENDING_APPROVAL` → `PENDING_PAYMENT` + invoice.',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          { in: 'path', name: 'appendixId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContractAppendixSign' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/ContractAppendix' },
            'Signed successfully'
          ),
          400: stdErrors[400],
          403: stdErrors[403],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['ContractAppendix'],
        summary: 'Xóa yêu cầu (PENDING / REJECTED)',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          { in: 'path', name: 'appendixId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/ContractAppendix' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/contracts/{contractId}/appendices/{appendixId}/payment-preview': {
      get: {
        tags: ['ContractAppendix'],
        summary: 'Xem trước tiền thanh toán phụ lục',
        description:
          '`initialInvoiceAmount = round(monthlyRate × billableMonths)` (một lần full theo hạn PL).',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          { in: 'path', name: 'appendixId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/ContractAppendixPaymentPreview' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/contracts/{contractId}/appendices/{appendixId}/invoices': {
      get: {
        tags: ['ContractAppendix'],
        summary: 'Invoice phụ lục (APPENDIX_INITIAL)',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          { in: 'path', name: 'appendixId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({
            type: 'array',
            items: { $ref: '#/components/schemas/ContractInvoice' },
          }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/contracts/{contractId}/appendices/{appendixId}/approve': {
      post: {
        tags: ['ContractAppendix'],
        summary: 'WH duyệt yêu cầu phụ lục',
        description: 'Role: **WH_ADMIN** / SYSTEM_ADMIN. → `PENDING_APPROVAL` (chờ tenant ký).',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          { in: 'path', name: 'appendixId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContractAppendixApprove' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/ContractAppendix' },
            'Appendix approved'
          ),
          400: stdErrors[400],
          403: stdErrors[403],
          404: stdErrors[404],
        },
      },
    },
    '/api/contracts/{contractId}/appendices/{appendixId}/reject': {
      post: {
        tags: ['ContractAppendix'],
        summary: 'WH từ chối yêu cầu phụ lục',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          { in: 'path', name: 'appendixId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContractAppendixReject' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/ContractAppendix' },
            'Appendix rejected'
          ),
          400: stdErrors[400],
          403: stdErrors[403],
          404: stdErrors[404],
        },
      },
    },
    '/api/contracts/{contractId}/appendices/{appendixId}/under-review': {
      post: {
        tags: ['ContractAppendix'],
        summary: 'WH đánh dấu đang xem xét',
        description: 'Role: **WH_ADMIN** / SYSTEM_ADMIN. `PENDING` → `UNDER_REVIEW`.',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          { in: 'path', name: 'appendixId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/ContractAppendix' },
            'Marked under review'
          ),
          400: stdErrors[400],
          403: stdErrors[403],
          404: stdErrors[404],
        },
      },
    },
    '/api/contracts/{contractId}/appendices/{appendixId}/invoices/{invoiceId}/payos/create-link': {
      post: {
        tags: ['ContractAppendix'],
        summary: 'PayOS — thanh toán phụ lục',
        description: 'Role: **TENANT_ADMIN**. Invoice `APPENDIX_INITIAL` của PL.',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          { in: 'path', name: 'appendixId', required: true, schema: uuid },
          { in: 'path', name: 'invoiceId', required: true, schema: uuid },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PayOSCreateLinkRequest' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/PayOSPaymentLink' }),
          400: stdErrors[400],
          403: stdErrors[403],
          404: stdErrors[404],
        },
      },
    },
    '/api/contracts/{contractId}/appendices/{appendixId}/invoices/{invoiceId}/mark-paid': {
      post: {
        tags: ['ContractAppendix'],
        summary: 'Ghi nhận đã thanh toán phụ lục (dev)',
        description: 'Role: **TENANT_ADMIN**, WH_ADMIN, SYSTEM_ADMIN.',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          { in: 'path', name: 'appendixId', required: true, schema: uuid },
          { in: 'path', name: 'invoiceId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({
            type: 'object',
            properties: {
              invoice: { $ref: '#/components/schemas/ContractInvoice' },
              contract: { $ref: '#/components/schemas/Contract' },
              appendix: { $ref: '#/components/schemas/ContractAppendix' },
            },
          }),
          400: stdErrors[400],
          403: stdErrors[403],
          404: stdErrors[404],
        },
      },
    },
    '/api/contracts/{contractId}/appendices/{appendixId}/terminate': {
      post: {
        tags: ['ContractAppendix'],
        summary: 'Chấm dứt chỉ phụ lục',
        description: 'Không phạt. HĐ gốc vẫn `ACTIVE`. Hủy reservation gắn PL.',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          { in: 'path', name: 'appendixId', required: true, schema: uuid },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContractAppendixTerminate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/ContractAppendix' },
            'Appendix terminated'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/contracts/{contractId}/termination/preview': {
      get: {
        tags: ['Contract'],
        summary: 'Xem trước phí / hoàn tiền khi chấm dứt HĐ',
        description:
          'HĐ `ACTIVE` hoặc `PENDING_PAYMENT`. Tính settlement theo `billingCycle` (MONTHLY/YEARLY), inbound, tổng đã trả. Không tạo bản ghi yêu cầu.',
        security: bearerSecurity,
        parameters: [{ in: 'path', name: 'contractId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/ContractTerminationPreview' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/contracts/{contractId}/termination/request': {
      post: {
        tags: ['Contract'],
        summary: 'Gửi yêu cầu chấm dứt hợp đồng sớm',
        description:
          'Chỉ HĐ `ACTIVE` (đã thanh toán invoice INITIAL). Tạo `contract_termination_requests` trạng thái `PENDING`. 409 nếu đã có yêu cầu chờ duyệt. WH duyệt: `POST …/termination/requests/{terminationRequestId}/approve`.',
        security: bearerSecurity,
        parameters: [{ in: 'path', name: 'contractId', required: true, schema: uuid }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContractTerminationRequestCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope({
            type: 'object',
            properties: {
              request: { type: 'object' },
              settlement: { $ref: '#/components/schemas/ContractTerminationPreview' },
            },
          }),
          400: stdErrors[400],
          404: stdErrors[404],
          409: stdErrors[409],
        },
      },
    },
    '/api/contracts/{contractId}/termination/requests': {
      get: {
        tags: ['Contract'],
        summary: 'Danh sách yêu cầu chấm dứt theo HĐ',
        description:
          'Roles: `WH_ADMIN`, `SYSTEM_ADMIN`, `TENANT_ADMIN`, `TENANT_STAFF`. Query `status` optional (PENDING, APPROVED, …).',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] },
          },
        ],
        responses: {
          200: successEnvelope({
            type: 'array',
            items: { $ref: '#/components/schemas/ContractTerminationRequestRow' },
          }),
          404: stdErrors[404],
        },
      },
    },
    '/api/contracts/{contractId}/termination/requests/{terminationRequestId}/approve': {
      post: {
        tags: ['Contract'],
        summary: 'WH duyệt chấm dứt HĐ',
        description:
          'Roles: `WH_ADMIN`, `SYSTEM_ADMIN`. `WH_ADMIN` chỉ duyệt HĐ thuộc `warehouseId` trong JWT (403 nếu kho khác). HĐ → `TERMINATED`; hủy reservation ACTIVE; hủy inbound DRAFT/PENDING. **Tồn kho không xóa** — tenant xuất hàng qua outbound. `reviewedBy` = user JWT.',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          { in: 'path', name: 'terminationRequestId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/ContractTerminationApproveResult' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/contracts/{contractId}/termination/requests/{terminationRequestId}/reject': {
      post: {
        tags: ['Contract'],
        summary: 'WH từ chối yêu cầu chấm dứt',
        description:
          'Roles: `WH_ADMIN`, `SYSTEM_ADMIN`. `WH_ADMIN` chỉ từ chối yêu cầu HĐ thuộc kho mình (403 nếu kho khác). Request → `REJECTED`; HĐ giữ `ACTIVE`.',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          { in: 'path', name: 'terminationRequestId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({
            type: 'object',
            properties: {
              request: { $ref: '#/components/schemas/ContractTerminationRequestRow' },
            },
          }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/contracts/{contractId}/invoices': {
      get: {
        tags: ['PayOS'],
        summary: 'List invoices of contract',
        description:
          'Flow 1 bước 12 — sau tenant ký (`PENDING_PAYMENT`). Lấy `invoiceId` của invoice category **INITIAL** (`paymentStatus=PENDING`) để gọi `payos/create-link`.',
        security: bearerSecurity,
        parameters: [{ in: 'path', name: 'contractId', required: true, schema: uuid }],
        responses: {
          200: successEnvelope({
            type: 'array',
            items: { $ref: '#/components/schemas/ContractInvoice' },
          }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/contracts/{contractId}/invoices/{invoiceId}/payos/create-link': {
      post: {
        tags: ['PayOS'],
        summary: 'Create PayOS checkout link (test thanh toán trên Swagger)',
        description:
          '**Flow 1 bước 13.** HĐ `PENDING_PAYMENT`, invoice INITIAL `PENDING`. Response `checkoutUrl` — mở tab thanh toán. Gọi lại endpoint trả cùng link nếu đơn PayOS đã tồn tại (`reusedExistingLink: true`). **Flow 1 bước 14:** sau khi trả, webhook PayOS → HĐ **`ACTIVE`** (tenant mới tạo inbound được).',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          { in: 'path', name: 'invoiceId', required: true, schema: uuid },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PayOSCreateLinkRequest' },
            },
          },
        },
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/PayOSPaymentLink' }),
          400: stdErrors[400],
          404: stdErrors[404],
          503: {
            description: 'PayOS chưa cấu hình (.env)',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/api/contracts/{contractId}/invoices/{invoiceId}/mark-paid': {
      post: {
        tags: ['PayOS'],
        summary: 'Mark invoice paid manually (dev / không qua PayOS)',
        description:
          '**Flow 1 bước 14 (dev/test)** — bỏ qua PayOS:\n' +
          '- `INITIAL` → HĐ `PENDING_PAYMENT` → **`ACTIVE`**\n' +
          '- `APPENDIX_INITIAL` → phụ lục `PENDING_PAYMENT` → `ACTIVE`',
        security: bearerSecurity,
        parameters: [
          { in: 'path', name: 'contractId', required: true, schema: uuid },
          { in: 'path', name: 'invoiceId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({
            type: 'object',
            properties: {
              invoice: { $ref: '#/components/schemas/ContractInvoice' },
              contract: { $ref: '#/components/schemas/Contract' },
              appendix: {
                $ref: '#/components/schemas/ContractAppendix',
                nullable: true,
              },
            },
          }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/payos/webhook': {
      get: {
        tags: ['PayOS'],
        summary: 'Webhook ping (kiểm tra URL / ngrok)',
        description: 'Public — không cần JWT. Dùng kiểm tra tunnel: phải trả `ok: true`.',
        responses: {
          200: {
            description: 'Webhook reachable',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PayOSWebhookPing' },
              },
            },
          },
        },
      },
      post: {
        tags: ['PayOS'],
        summary: 'PayOS payment webhook (PayOS server → BE)',
        description:
          '**Không test trên Swagger** (body rỗng → 400). PayOS gọi sau thanh toán. Dev: `npm run payos:test-webhook`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Payload có code, desc, success, data, signature từ PayOS',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Webhook accepted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'object' },
                  },
                },
              },
            },
          },
          400: stdErrors[400],
        },
      },
    },

    '/api/contract-items': {
      get: {
        tags: ['ContractItem'],
        summary: 'List contract items',
        parameters: [
          { in: 'query', name: 'contractId', required: true, schema: uuid },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/ContractItem' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      post: {
        tags: ['ContractItem'],
        summary: 'Create contract item',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContractItemCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/ContractItem' },
            'Contract item created'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/contract-items/{contractItemId}': {
      get: {
        tags: ['ContractItem'],
        summary: 'Get contract item by ID',
        parameters: [
          { in: 'path', name: 'contractItemId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/ContractItem' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['ContractItem'],
        summary: 'Update contract item',
        parameters: [
          { in: 'path', name: 'contractItemId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContractItemUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/ContractItem' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['ContractItem'],
        summary: 'Delete contract item',
        parameters: [
          { in: 'path', name: 'contractItemId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/ContractItem' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/storage-reservations': {
      get: {
        tags: ['StorageReservation'],
        summary: 'List storage reservations',
        parameters: [
          { in: 'query', name: 'contractId', schema: uuid },
          { in: 'query', name: 'tenantId', schema: uuid },
          { in: 'query', name: 'warehouseId', schema: uuid },
          { in: 'query', name: 'zoneId', schema: uuid },
          { in: 'query', name: 'rackId', schema: uuid },
          { in: 'query', name: 'rackLevelId', schema: uuid },
          { in: 'query', name: 'binId', schema: uuid },
          {
            in: 'query',
            name: 'storageLevel',
            schema: {
              type: 'string',
              enum: ['WAREHOUSE', 'ZONE', 'RACK', 'RACK_LEVEL', 'BIN'],
            },
          },
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string', enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'] },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: paginatedEnvelope({ $ref: '#/components/schemas/StorageReservation' }),
          400: stdErrors[400],
        },
      },
      post: {
        tags: ['StorageReservation'],
        summary: 'Create storage reservation',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StorageReservationCreate' },
            },
          },
        },
        responses: {
          201: successEnvelope(
            { $ref: '#/components/schemas/StorageReservation' },
            'Reservation created'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },
    '/api/storage-reservations/{reservationId}': {
      get: {
        tags: ['StorageReservation'],
        summary: 'Get storage reservation by ID',
        parameters: [
          { in: 'path', name: 'reservationId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope({ $ref: '#/components/schemas/StorageReservation' }),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      patch: {
        tags: ['StorageReservation'],
        summary: 'Update storage reservation',
        parameters: [
          { in: 'path', name: 'reservationId', required: true, schema: uuid },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StorageReservationUpdate' },
            },
          },
        },
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/StorageReservation' },
            'Updated successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
      delete: {
        tags: ['StorageReservation'],
        summary: 'Delete storage reservation',
        parameters: [
          { in: 'path', name: 'reservationId', required: true, schema: uuid },
        ],
        responses: {
          200: successEnvelope(
            { $ref: '#/components/schemas/StorageReservation' },
            'Deleted successfully'
          ),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password bằng token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'newPassword'],
                properties: {
                  token: { type: 'string' },
                  newPassword: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          200: successEnvelope({ type: 'object' }, 'Password updated successfully'),
          400: stdErrors[400],
          404: stdErrors[404],
        },
      },
    },

    '/api/admin/notifications/guest-account-alerts': {
      get: {
        tags: ['User'],
        summary: 'SYSTEM_ADMIN: guest account alerts',
        security: bearerSecurity,
        responses: { 200: successEnvelope({ type: 'object' }), 403: stdErrors[403] },
      },
    },
    '/api/admin/notifications/wh-pending-rentals': {
      get: {
        tags: ['Warehouse'],
        summary: 'WH_ADMIN: pending rental alerts',
        security: bearerSecurity,
        responses: { 200: successEnvelope({ type: 'object' }), 403: stdErrors[403] },
      },
    },
    '/api/admin/notifications/wh-pending-inbounds': {
      get: {
        tags: ['Warehouse'],
        summary: 'WH_ADMIN: pending inbound alerts',
        security: bearerSecurity,
        responses: { 200: successEnvelope({ type: 'object' }), 403: stdErrors[403] },
      },
    },
    '/api/admin/notifications/wh-arrived-inbounds': {
      get: {
        tags: ['Warehouse'],
        summary: 'WH_ADMIN: arrived inbound alerts',
        security: bearerSecurity,
        responses: { 200: successEnvelope({ type: 'object' }), 403: stdErrors[403] },
      },
    },
    '/api/admin/notifications/wh-contract-payments': {
      get: {
        tags: ['Contract'],
        summary: 'WH_ADMIN: recent contract payment alerts',
        security: bearerSecurity,
        responses: { 200: successEnvelope({ type: 'object' }), 403: stdErrors[403] },
      },
    },
    '/api/admin/notifications/transporter-trips': {
      get: {
        tags: ['InboundRequest'],
        summary: 'WH_TRANSPORTER: assigned trip alerts',
        security: bearerSecurity,
        responses: { 200: successEnvelope({ type: 'object' }), 403: stdErrors[403] },
      },
    },
    '/api/admin/notifications/tenant-inbound-transport': {
      get: {
        tags: ['InboundRequest'],
        summary: 'TENANT_ADMIN: inbound transport alerts',
        security: bearerSecurity,
        responses: { 200: successEnvelope({ type: 'object' }), 403: stdErrors[403] },
      },
    },

    '/api/locations': {
      get: {
        tags: ['System'],
        summary: 'List city/district tree',
        responses: { 200: successEnvelope({ type: 'array', items: { type: 'object' } }) },
      },
    },
    '/api/locations/warehouses': {
      get: {
        tags: ['Warehouse'],
        summary: 'List warehouses by city/district',
        parameters: [
          {
            in: 'query',
            name: 'city',
            required: true,
            schema: { type: 'string', enum: SEEDED_CITIES, example: 'TP.HCM' },
          },
          {
            in: 'query',
            name: 'district',
            required: true,
            schema: { type: 'string', enum: SEEDED_DISTRICTS, example: 'Quận 7' },
          },
        ],
        responses: {
          200: successEnvelope({ type: 'array', items: { type: 'object' } }),
          400: stdErrors[400],
        },
      },
    },

    '/api/product-kinds': {
      get: {
        tags: ['Category'],
        summary: 'List product kind catalog',
        responses: { 200: successEnvelope({ type: 'array', items: { type: 'object' } }) },
      },
    },
    '/api/product-kinds/tree': {
      get: {
        tags: ['Category'],
        summary: 'Product kind tree',
        responses: { 200: successEnvelope({ type: 'array', items: { type: 'object' } }) },
      },
    },
    '/api/product-kinds/groups': {
      get: {
        tags: ['Category'],
        summary: 'List product kind groups',
        responses: { 200: successEnvelope({ type: 'array', items: { type: 'string' } }) },
      },
    },
    '/api/product-kinds/{productKind}': {
      get: {
        tags: ['Category'],
        summary: 'Get product kind by code',
        parameters: [{ in: 'path', name: 'productKind', required: true, schema: { type: 'string' } }],
        responses: { 200: successEnvelope({ type: 'object' }), 404: stdErrors[404] },
      },
    },
    '/api/size-factors': {
      get: {
        tags: ['Category'],
        summary: 'List size factor catalog',
        responses: { 200: successEnvelope({ type: 'array', items: { type: 'object' } }) },
      },
    },
    '/api/size-factors/{sizeGroup}': {
      get: {
        tags: ['Category'],
        summary: 'Get size factors by group',
        parameters: [{ in: 'path', name: 'sizeGroup', required: true, schema: { type: 'string' } }],
        responses: { 200: successEnvelope({ type: 'array', items: { type: 'object' } }) },
      },
    },

    '/api/zones/planning': {
      get: {
        tags: ['Zone'],
        summary: 'Planning list for zones',
        security: bearerSecurity,
        responses: { 200: successEnvelope({ type: 'array', items: { type: 'object' } }) },
      },
    },
    '/api/zones/bulk': {
      post: {
        tags: ['Zone'],
        summary: 'Create zones in bulk',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { type: 'object' } },
          },
        },
        responses: { 201: successEnvelope({ type: 'array', items: { type: 'object' } }), 400: stdErrors[400] },
      },
    },
    '/api/racks/bulk': {
      post: {
        tags: ['Rack'],
        summary: 'Create racks in bulk',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 201: successEnvelope({ type: 'array', items: { type: 'object' } }), 400: stdErrors[400] },
      },
    },
    '/api/bins/bulk': {
      post: {
        tags: ['Bin'],
        summary: 'Create bins in bulk',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 201: successEnvelope({ type: 'array', items: { type: 'object' } }), 400: stdErrors[400] },
      },
    },
    '/api/bins/bulk-delete': {
      post: {
        tags: ['Bin'],
        summary: 'Bulk delete bins',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: successEnvelope({ type: 'object' }), 400: stdErrors[400] },
      },
    },

    '/api/inbound-requests/{inboundRequestId}/approval-readiness': {
      get: {
        tags: ['InboundRequest'],
        summary: 'Check inbound approval readiness',
        description:
          '**Flow 3 bước 5** — ước tính LPN/capacity, zone HĐ, free bins trước khi WH `APPROVED`.',
        parameters: [{ in: 'path', name: 'inboundRequestId', required: true, schema: uuid }],
        security: bearerSecurity,
        responses: { 200: successEnvelope({ type: 'object' }), 400: stdErrors[400], 404: stdErrors[404] },
      },
    },
    '/api/inbound-requests/{inboundRequestId}/delivery': {
      get: {
        tags: ['InboundRequest'],
        summary: 'Get inbound delivery info',
        description: 'Flow 3 bước 4 — thông tin xe / pickup / tài xế gán.',
        parameters: [{ in: 'path', name: 'inboundRequestId', required: true, schema: uuid }],
        security: bearerSecurity,
        responses: { 200: successEnvelope({ type: 'object' }), 404: stdErrors[404] },
      },
      put: {
        tags: ['InboundRequest'],
        summary: 'Upsert inbound delivery info',
        description:
          '**Flow 3 bước 4–7.** Tenant: `pickupAddress` (WAREHOUSE_TRANSPORT). WH: `vehiclePlate`, `assignedDriverUserId`. Transporter: cập nhật xe của chuyến mình. Status inbound: `PENDING`/`APPROVED`/`ARRIVED`.',
        parameters: [{ in: 'path', name: 'inboundRequestId', required: true, schema: uuid }],
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: successEnvelope({ type: 'object' }), 400: stdErrors[400] },
      },
      delete: {
        tags: ['InboundRequest'],
        summary: 'Delete inbound delivery info',
        parameters: [{ in: 'path', name: 'inboundRequestId', required: true, schema: uuid }],
        security: bearerSecurity,
        responses: { 200: successEnvelope({ type: 'object' }), 404: stdErrors[404] },
      },
    },
    '/api/inbound-requests/{inboundRequestId}/bulk-putaway': {
      post: {
        tags: ['InboundRequest'],
        summary: 'Bulk putaway inbound items',
        description:
          'Flow 3 — putaway nhiều LPN (body `assignments[]`). Không dùng AI slot scoring; xem Flow 5 cho gợi ý bin.',
        parameters: [{ in: 'path', name: 'inboundRequestId', required: true, schema: uuid }],
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: successEnvelope({ type: 'object' }), 400: stdErrors[400] },
      },
    },
    '/api/inbound-requests/{inboundRequestId}/auto-putaway': {
      post: {
        tags: ['InboundRequest'],
        summary: 'Auto putaway inbound items',
        description:
          'Flow 3 — gán bin theo reservation HĐ + zone (`zoneId` bắt buộc). Khác Flow 5 (AI score bin). Sau auto vẫn có thể dùng AI cho LPN còn lại.',
        parameters: [{ in: 'path', name: 'inboundRequestId', required: true, schema: uuid }],
        security: bearerSecurity,
        requestBody: {
          required: false,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: successEnvelope({ type: 'object' }), 400: stdErrors[400] },
      },
    },
    '/api/inbound-requests/{inboundRequestId}/report-arrival': {
      post: {
        tags: ['InboundRequest'],
        summary: 'Report driver arrival at warehouse',
        description:
          '**Flow 3 bước 8.** `WH_TRANSPORTER` + `WAREHOUSE_TRANSPORT` + `APPROVED` → `ARRIVED`. Không dùng PATCH `ARRIVED` cho mode này.',
        parameters: [{ in: 'path', name: 'inboundRequestId', required: true, schema: uuid }],
        security: bearerSecurity,
        requestBody: {
          required: false,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: successEnvelope({ type: 'object' }), 400: stdErrors[400] },
      },
    },

    '/api/shipments': {
      get: {
        tags: ['OutboundRequest'],
        summary: 'List shipments',
        parameters: [{ $ref: '#/components/parameters/page' }, { $ref: '#/components/parameters/limit' }],
        responses: { 200: paginatedEnvelope({ type: 'object' }), 400: stdErrors[400] },
      },
      post: {
        tags: ['OutboundRequest'],
        summary: 'Create shipment',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 201: successEnvelope({ type: 'object' }, 'Created successfully'), 400: stdErrors[400] },
      },
    },
    '/api/shipments/{shipmentId}': {
      get: {
        tags: ['OutboundRequest'],
        summary: 'Get shipment by ID',
        parameters: [{ in: 'path', name: 'shipmentId', required: true, schema: uuid }],
        responses: { 200: successEnvelope({ type: 'object' }), 400: stdErrors[400], 404: stdErrors[404] },
      },
      patch: {
        tags: ['OutboundRequest'],
        summary: 'Update shipment',
        parameters: [{ in: 'path', name: 'shipmentId', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: successEnvelope({ type: 'object' }, 'Updated successfully'), 400: stdErrors[400] },
      },
      delete: {
        tags: ['OutboundRequest'],
        summary: 'Delete shipment',
        parameters: [{ in: 'path', name: 'shipmentId', required: true, schema: uuid }],
        responses: { 200: successEnvelope({ type: 'object' }, 'Deleted successfully'), 400: stdErrors[400], 404: stdErrors[404] },
      },
    },

    '/api/warehouses/{warehouseId}/zone-planning': {
      get: {
        tags: ['Warehouse'],
        summary: 'Warehouse zone planning',
        security: bearerSecurity,
        parameters: [{ in: 'path', name: 'warehouseId', required: true, schema: uuid }],
        responses: { 200: successEnvelope({ type: 'object' }), 400: stdErrors[400], 404: stdErrors[404] },
      },
    },
    '/api/warehouses/{warehouseId}/capacity-snapshot': {
      get: {
        tags: ['Warehouse'],
        summary: 'Warehouse capacity snapshot',
        security: bearerSecurity,
        parameters: [{ in: 'path', name: 'warehouseId', required: true, schema: uuid }],
        responses: { 200: successEnvelope({ type: 'object' }), 400: stdErrors[400], 404: stdErrors[404] },
      },
    },

    '/api/rental-requests/{rentalRequestId}/price-estimate': {
      get: {
        tags: ['RentalRequest'],
        summary: 'Get rental request price estimate',
        security: bearerSecurity,
        parameters: [{ in: 'path', name: 'rentalRequestId', required: true, schema: uuid }],
        responses: { 200: successEnvelope({ type: 'object' }), 400: stdErrors[400], 404: stdErrors[404] },
      },
    },
  },
};

export default spec;
