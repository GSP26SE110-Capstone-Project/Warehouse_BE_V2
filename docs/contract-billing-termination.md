# Hợp đồng — Billing MONTHLY, phụ phí trả trước, chấm dứt

Tài liệu chốt nghiệp vụ (tháng 6/2026). Tham chiếu schema: `scripts/sql/db4_schema.sql`, migration `scripts/sql/invoice_operational_refs.sql`.

## 1. Billing cycle — chỉ MONTHLY

| Giá trị   | Cho phép API/FE | Ghi chú                          |
| --------- | --------------- | -------------------------------- |
| `MONTHLY` | Có              | Thuê theo tháng                  |
| `YEARLY`  | **Không**       | Migration ép bản ghi cũ → MONTHLY |

### 1.1 Mốc hợp đồng

- **`startDate` = ngày WH approve** rental request (`reviewed_at`), không dùng `expectedStartDate` của tenant làm mốc.
- **`endDate` = startDate + số tháng** khách chọn khi đăng ký.
- **Billing anchor** cho invoice định kỳ = `startDate` (không dùng `activated_at`).

### 1.2 Sau khi ký đủ hai bên

| Bước | Hành vi |
| ---- | ------- |
| Tenant ký | `PENDING_PAYMENT` + tạo invoice `INITIAL` |
| INITIAL | Tiền thuê **tháng đầu** = `deriveMonthlyRent(contract)` |
| Hạn thanh toán | **3 ngày** kể từ `issuedAt` (`INVOICE_PAYMENT_DUE_DAYS`) |
| Tenant thanh toán INITIAL | `ACTIVE` (+ set `activated_at` để audit) |

### 1.3 Invoice định kỳ (RECURRING_RENT)

- Cron hàng ngày (`billingJobs.js` — `0 1 * * *`).
- Với HĐ `ACTIVE`, `billing_cycle = MONTHLY`, `end_date >= today`:
  - Nếu hôm nay trùng **ngày trong tháng** của `startDate` → tạo `RECURRING_RENT`.
  - **Chỉ tiền thuê tháng mới** — không cộng phụ phí tháng trước.
  - Bỏ qua kỳ trùng tháng đầu (đã thu qua INITIAL).
- `dueDate = issuedAt + 3 ngày`.

### 1.4 Phụ phí vận hành (OPERATIONAL) — trả trước

| Loại | Trigger | Gate |
| ---- | ------- | ---- |
| Inbound LPN (+ transport nếu `WAREHOUSE_TRANSPORT`) | Tạo inbound request | WH **approve** chỉ khi invoice `PAID` |
| Outbound LPN (+ transport) | Tạo outbound request | WH **approve / pick** chỉ khi invoice `PAID` |
| Transport assign driver | WH gán tài xế | Invoice `PAID` + **cùng city + district** với kho |

Giá (xem `pricingDefaults.js`):

- Inbound/Outbound LPN: SMALL 2k, MEDIUM 3k, LARGE 5k, EXTRA 8k / LPN
- `WAREHOUSE_TRANSPORT`: **250.000 ₫** / chuyến — **cấm cross-city**, chỉ cùng quận kho

Schema: `invoices.source_type` + `source_id` (unique per contract).

## 2. Máy trạng thái hợp đồng

```
DRAFT
  → WH gửi / ký → PENDING_APPROVAL
  → Tenant ký → PENDING_PAYMENT + invoice INITIAL
  → Thanh toán INITIAL (3 ngày) → ACTIVE
  → Hết hạn → EXPIRED
  → Chấm dứt sớm / quá hạn invoice → TERMINATED
  → Hủy trước ký → CANCELLED
```

### Điều kiện inbound / outbound

**Inbound**

- `contract.status === 'ACTIVE'`
- Invoice INITIAL `PAID`
- Invoice OPERATIONAL inbound `PAID` (trước WH approve)

**Outbound**

- HĐ `ACTIVE` (hoặc `TERMINATED` để xuất hết tồn)
- Invoice INITIAL `PAID` (khi ACTIVE)
- Invoice OPERATIONAL outbound `PAID` (trước approve/pick)
- ≥ 1 inbound `COMPLETED` trên HĐ; tồn khả dụng > 0

## 3. Quá hạn thanh toán (3 ngày)

Job `invoiceOverdue.service.js` (cùng cron billing):

1. `invoices` WHERE `payment_status = 'PENDING'` AND `due_date < NOW()`
2. HĐ `ACTIVE` hoặc `PENDING_PAYMENT` → `TERMINATED`
3. `storage_reservations` → `CANCELLED`
4. Thông báo tenant + WH

Áp dụng **mọi** invoice (INITIAL, RECURRING_RENT, OPERATIONAL).

## 4. Chấm dứt hợp đồng sớm (tenant request)

Bảng: `contract_termination_requests`.

- **MONTHLY only**: không phạt thêm 1 tháng tiền thuê; preview refund mặc định theo chính sách vận hành.
- Logic YEARLY refund đã bỏ.

## 5. PayOS & FE

- Tenant thanh toán qua PayOS trên `TenantContractsPage` (INITIAL, RECURRING_RENT).
- Phụ phí: panel PayOS trên chi tiết inbound/outbound trước thao tác WH.
- Notification bell: đếm mọi invoice `PENDING` trên HĐ tenant.
