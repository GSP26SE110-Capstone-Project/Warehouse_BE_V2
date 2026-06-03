# Phụ lục hợp đồng (Contract Appendix)

Luồng giống onboarding HĐ: **tenant gửi yêu cầu** → **kho duyệt/từ chối** → **tenant ký** → **thanh toán** → gắn vào HĐ gốc.

## 1. Phạm vi cấp không gian

Thứ tự (nhỏ → lớn): `BIN` → `RACK_LEVEL` → `RACK` → `ZONE` → `WAREHOUSE`.

| Yêu cầu | Kết quả |
|---------|---------|
| Cấp ≤ trần HĐ gốc | Được gửi **yêu cầu phụ lục** |
| Cấp > trần | API `400` `APPENDIX_NEED_NEW_CONTRACT` — phải **tạo hợp đồng mới** |

`GET …/appendices/ceiling` — xem trần hiện tại.

## 2. Trạng thái

```
TENANT_ADMIN POST (yêu cầu) → PENDING
  → WH PATCH (tùy chọn) → UNDER_REVIEW
  → WH POST approve (+ giá, cấp bin, ký kho) → PENDING_APPROVAL
  → WH POST reject (+ rejectionReason) → REJECTED
  → TENANT_ADMIN PATCH (tenantSignature) → PENDING_PAYMENT + invoice APPENDIX_INITIAL
  → Thanh toán → ACTIVE (gắn HĐ gốc)
  → terminate PL → TERMINATED (HĐ gốc vẫn ACTIVE)
  → terminate HĐ gốc → mọi PL đang mở → TERMINATED
```

## 3. Thanh toán

`estimatedDeltaAmount` = **đơn giá / tháng** (WH nhập khi **duyệt**).

```text
invoice = round(monthlyRate × billableMonths)
```

`billableMonths` = số tháng thực tế từ `effectiveDate` → `endDate` (VD giữa tháng 1 → cuối tháng 3 ≈ 2,5 tháng).

PayOS / `mark-paid`: `POST …/appendices/{appendixId}/invoices/{invoiceId}/…` (có auth + kiểm invoice thuộc PL).

## 4. API & quyền

| Method | Path | Role |
|--------|------|------|
| `GET` | `…/appendices/ceiling` | Tenant / WH |
| `GET` | `…/appendices` | Tenant / WH |
| `POST` | `…/appendices` | **TENANT_ADMIN** — gửi yêu cầu |
| `POST` | `…/appendices/:id/approve` | **WH_ADMIN**, SYSTEM_ADMIN |
| `POST` | `…/appendices/:id/reject` | **WH_ADMIN**, SYSTEM_ADMIN |
| `PATCH` | `…/appendices/:id` | **TENANT_ADMIN** — ký (`tenantSignature`) |
| `POST` | `…/under-review` | WH — `PENDING` → `UNDER_REVIEW` |
| `GET` | `…/payment-preview` | Tenant / WH |
| `POST` | `…/invoices/:invoiceId/payos/create-link` | **TENANT_ADMIN** — PayOS |
| `POST` | `…/invoices/:invoiceId/mark-paid` | Tenant / WH (dev) |
| `POST` | `…/terminate` | WH |
| `DELETE` | `…/appendices/:id` | PENDING / REJECTED |

Mọi route cần header `Authorization: Bearer <token>`.

### Tenant — gửi yêu cầu

```json
POST /api/contracts/{contractId}/appendices
{
  "title": "Thuê thêm 2 bin",
  "effectiveDate": "2026-01-15",
  "endDate": "2026-03-31",
  "requestedStorageLevel": "BIN",
  "items": [{ "itemType": "STORAGE", "storageLevel": "BIN", "billingUnit": "BIN_DAY", "quantity": 2 }]
}
```

### WH — duyệt

```json
POST /api/contracts/{contractId}/appendices/{appendixId}/approve
{
  "estimatedDeltaAmount": 4000000,
  "warehouseSignature": "...",
  "reviewNote": "Đã cấp bin A-01, A-02",
  "reservations": [{ "reservationType": "RESERVED", "storageLevel": "BIN", "warehouseId": "...", "binId": "..." }]
}
```

### WH — từ chối

```json
POST .../reject
{ "rejectionReason": "Không còn bin trống trong zone" }
```

### Tenant — ký

```json
PATCH .../appendices/{appendixId}
{ "tenantSignature": "..." }
```

## 5. Liên kết

- [contract-billing-termination.md](./contract-billing-termination.md)
