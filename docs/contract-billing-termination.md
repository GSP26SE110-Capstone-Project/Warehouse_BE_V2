# Hợp đồng — Billing cycle, thanh toán, chấm dứt

Tài liệu chốt nghiệp vụ (tháng 6/2026). Tham chiếu schema: `scripts/sql/db4_schema.sql`, API tổng: `docs/request.md`.

## 1. Billing cycle (chỉ MONTHLY & YEARLY)

| Giá trị | Cho phép API/FE | Ghi chú |
|---------|-----------------|--------|
| `MONTHLY` | Có | Thuê theo tháng |
| `YEARLY` | Có | Trả trước cả kỳ HĐ (thường 12 tháng) |
| `DAILY`, `QUARTERLY` | Không (legacy DB) | Migration ép bản ghi cũ → `MONTHLY` |

### 1.1 Sau khi ký đủ hai bên

| Chu kỳ | Invoice đầu (`INITIAL`) | Kích hoạt HĐ |
|--------|-------------------------|--------------|
| **MONTHLY** | Tiền thuê **tháng đầu** = `estimatedTotalAmount ÷ số tháng HĐ` | `PENDING_PAYMENT` → thanh toán invoice đầu → `ACTIVE` |
| **YEARLY** | **Toàn bộ** `estimatedTotalAmount` (full kỳ) | Cùng luồng |

**Không** chuyển thẳng `ACTIVE` khi tenant ký; trạng thái `PENDING_PAYMENT` cho đến khi invoice đầu `PAID`.

### 1.2 Phụ phí vận hành (inbound/outbound/handling…)

| Chu kỳ | Lịch phát hành | Nội dung invoice |
|--------|----------------|------------------|
| **MONTHLY** | **Đầu mỗi tháng** | Tiền thuê tháng mới (`RECURRING_RENT`) + phụ phí tháng trước (`OPERATIONAL`) |
| **YEARLY** | **Cuối mỗi tháng** | Chỉ phụ phí tháng đó (`OPERATIONAL`) — tiền thuê năm đã thu ở invoice đầu |

> Cron/job phát hành định kỳ: phase sau; schema đã có `invoice_category` để phân loại.

## 2. Máy trạng thái hợp đồng

```
DRAFT
  → WH gửi / ký → PENDING_APPROVAL (kho đã ký, chờ cấp bin + tenant ký)
  → Tenant ký (đủ chữ ký) → PENDING_PAYMENT + tạo invoice INITIAL
  → Tenant thanh toán invoice đầu → ACTIVE
  → Hết hạn tự nhiên → EXPIRED
  → Chấm dứt sớm (đã duyệt) → TERMINATED
  → Hủy trước ký / hủy nội bộ → CANCELLED
```

### Điều kiện inbound / outbound

- `contract.status === 'ACTIVE'`
- Invoice đầu (`invoice_category = 'INITIAL'`) có `payment_status = 'PAID'`

## 3. Chấm dứt hợp đồng sớm

Bảng: `contract_termination_requests`.

### 3.1 MONTHLY

- **Không** phạt thêm 1 tháng tiền thuê (termination fee = 0).
- Hoàn tiền: theo chính sách vận hành (mặc định preview = 0 nếu không có logic prorate riêng).

### 3.2 YEARLY — chưa có inbound

- `processingFee = round(totalPaid × 1%)`
- `refundAmount = max(0, totalPaid − processingFee)`
- `hasInbound = false`

### 3.3 YEARLY — đã có inbound

- `monthlyRate = estimatedTotalAmount ÷ contractMonths` (làm tròn VND)
- `usedMonths` = số tháng đã qua kể từ `startDate` (tối thiểu 1 nếu đã vào kỳ)
- `unusedMonths = max(0, contractMonths − usedMonths)`
- `terminationFee = 1 × monthlyRate` (phạt 1 tháng)
- `refundAmount = max(0, totalPaid − unusedMonths × monthlyRate − terminationFee)`

**Ví dụ:** Trả 120.000.000 VND / 12 tháng, dùng 6 tháng, đã inbound:

- `monthlyRate = 10.000.000`
- `unusedMonths = 6`
- `refund = 120.000.000 − 6×10.000.000 − 10.000.000 = 50.000.000`

### 3.4 Luồng API

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/contracts/:contractId/termination/preview` | Xem phí / hoàn trước khi gửi |
| `POST` | `/contracts/:contractId/termination/request` | Tạo yêu cầu `PENDING` |
| `POST` | `/contracts/:contractId/invoices/:invoiceId/payos/create-link` | Link thanh toán PayOS |
| `POST` | `/api/payos/webhook` | Webhook PayOS |
| `POST` | `/contracts/:contractId/invoices/:invoiceId/mark-paid` | Ghi nhận thủ công (dev) |

WH admin duyệt request → `APPROVED` + `contract.status = TERMINATED` (bước confirm có thể mở rộng sau).

## 4. Công thức tiền thuê tháng (dùng chung)

```text
contractMonths = max(1, floor((endDate − startDate) / 30 ngày billing))
monthlyRent      = round(estimatedTotalAmount / contractMonths)
initialInvoice   = MONTHLY ? monthlyRent : estimatedTotalAmount
```

## 5. Thay đổi code (checklist)

- [x] Doc này
- [x] Migration `contract_billing_termination.sql`
- [x] `BILLING_CYCLE` chỉ `MONTHLY` | `YEARLY`
- [x] `PENDING_PAYMENT` + invoice INITIAL + mark-paid → ACTIVE
- [x] Inbound gate: ACTIVE + invoice INITIAL PAID
- [x] Termination preview / request
- [ ] Cron invoice định kỳ (MONTHLY đầu tháng / YEARLY cuối tháng)
- [x] UI tenant: **Thanh toán PayOS** → redirect `checkoutUrl`; return `/staff/contracts/payment/return`
- [x] BE: `@payos/node`, webhook `/api/payos/webhook`, bảng `payments.payos_order_code`

### Hướng dẫn dev ngrok + PayOS

**Chi tiết từng bước (cài ngrok, `.env`, PayOS, test):** [ngrok-payos-dev.md](./ngrok-payos-dev.md)

### Hướng dẫn cấu hình PayOS (my.payos.vn + project)

#### A. Trên cổng PayOS

1. **Đăng ký / đăng nhập**  
   Vào [https://my.payos.vn](https://my.payos.vn) → tạo tài khoản merchant.

2. **Xác thực tổ chức**  
   Menu **Tổ chức** (hoặc **Xác thực**) → nộp giấy tờ doanh nghiệp / cá nhân → chờ PayOS duyệt.  
   Chưa duyệt thì thường **không tạo được kênh thanh toán** hoặc không nhận tiền thật.

3. **Liên kết ngân hàng**  
   Thêm ít nhất **một tài khoản ngân hàng** nhận tiền (theo hướng dẫn PayOS: “Kết nối tài khoản ngân hàng”).

4. **Tạo kênh thanh toán**  
   Menu **Kênh thanh toán** → **Tạo kênh thanh toán** → điền tên, logo → chọn ngân hàng chính → **Hoàn tất**.  
   Sau bước này PayOS hiển thị **3 key** (copy ngay, chỉ hiện đầy đủ lúc tạo / trong chi tiết kênh):

   | Key trên PayOS | Biến `.env` project |
   |----------------|---------------------|
   | Client ID | `PAYOS_CLIENT_ID` |
   | API Key | `PAYOS_API_KEY` |
   | Checksum Key | `PAYOS_CHECKSUM_KEY` |

5. **Cấu hình Webhook URL (quan trọng)**  
   Vào **chi tiết kênh thanh toán** vừa tạo → mục **Webhook** → nhập URL:

   | Môi trường | Webhook URL |
   |------------|-------------|
   | Dev (ngrok) | `https://<subdomain>.ngrok-free.app/api/payos/webhook` |
   | Production | `https://<domain-api-của-bạn>/api/payos/webhook` |

   - URL phải là **HTTPS**, trỏ tới **backend** (port 3000), **không** trỏ FE (5173).
   - PayOS có thể gửi **giao dịch mẫu** để test — server phải trả **HTTP 200**.
   - Nếu dashboard có nút **Lưu / Xác nhận webhook**, bấm sau khi BE đang chạy và ngrok bật.

   Tài liệu PayOS: [Tạo kênh thanh toán](https://payos.vn/docs/huong-dan-su-dung/tao-kenh-thanh-toan/) · [Webhook](https://payos.vn/docs/api/).

6. **Return / Cancel URL**  
   **Không** cấu hình cố định trên PayOS cho từng đơn — project **tự gửi** khi tạo link:

   - Thành công: `{PAYOS_RETURN_ORIGIN}/staff/contracts/payment/return?contractId=...&invoiceId=...`
   - Hủy: `{PAYOS_RETURN_ORIGIN}/staff/contracts/payment/cancel?...`

#### B. Trong project (Warehouse_BE_V2)

1. Mở `Warehouse_BE_V2/.env`, thêm (không commit file này):

```env
PAYOS_CLIENT_ID=<Client ID từ kênh>
PAYOS_API_KEY=<API Key từ kênh>
PAYOS_CHECKSUM_KEY=<Checksum Key từ kênh>
# URL giao diện FE — không slash cuối
PAYOS_RETURN_ORIGIN=http://localhost:5173
```

2. **Restart backend** (`npm run dev`) sau khi sửa `.env`.

3. **Dev local — dùng ngrok** (xem [ngrok-payos-dev.md](./ngrok-payos-dev.md)):

```env
PAYOS_WEBHOOK_PUBLIC_URL=https://xxxx.ngrok-free.app
```

```bash
ngrok http 3000
npm run payos:confirm-webhook   # hoặc dán webhook thủ công trên my.payos.vn
```

4. **FE:** chạy Vite (thường `http://localhost:5173`), proxy API về `http://127.0.0.1:3000` (đã có trong `vite.config.ts`).

#### C. Kiểm tra luồng

| Bước | Việc cần thấy |
|------|----------------|
| 1 | Tenant ký HĐ → status `PENDING_PAYMENT`, có invoice INITIAL |
| 2 | **Thanh toán PayOS** → mở trang checkout PayOS (QR / chuyển khoản) |
| 3 | Thanh toán xong → redirect về `/staff/contracts/payment/return` |
| 4 | Vài giây sau webhook chạy → invoice `PAID`, HĐ `ACTIVE` |
| 5 | Tạo được inbound |

**Lỗi thường gặp**

| Triệu chứng | Cách xử lý |
|-------------|------------|
| `PayOS chưa cấu hình` | Thiếu 1 trong 3 biến `.env` hoặc chưa restart BE |
| Mở PayOS lỗi 401 | Sai Client ID / API Key hoặc nhầm kênh |
| Trả tiền xong nhưng HĐ vẫn chờ thanh toán | Webhook sai URL, ngrok tắt, hoặc BE không nhận POST `/api/payos/webhook` |
| Return về FE nhưng không ACTIVE | Chờ webhook; refresh trang Hợp đồng; xem log BE khi PayOS gọi webhook |
| Số tiền &lt; 1000 VND | Invoice `estimatedTotalAmount` quá nhỏ — PayOS tối thiểu ~1000 |

**Sandbox / test:** Nếu PayOS bật chế độ thử nghiệm trên kênh, dùng tài khoản / số tiền theo hướng dẫn sandbox của PayOS (xem mục kênh trên my.payos.vn).

## 6. Liên kết

- Giá ước tính HĐ: `contractPriceEstimate.service.js`, `docs/pricing.md`
- Ký HĐ: `contract.service.js` — kho ký trước, tenant ký sau khi có `storage_reservations` ACTIVE
