# Dev local: Ngrok + PayOS + project

Hướng dẫn chạy **Smart Warehouse BE** trên máy và cho PayOS gọi webhook qua **ngrok**.

## Tổng quan

```text
[Tenant FE localhost:5173]
        │  API proxy → localhost:3000
        ▼
[BE npm run dev :3000]  ←── ngrok tunnel ──→  https://xxxx.ngrok-free.app
        ▲
        │  POST /api/payos/webhook
[PayOS my.payos.vn]
```

- **FE** (`PAYOS_RETURN_ORIGIN`): vẫn `http://localhost:5173` — khách quay lại sau thanh toán.
- **Webhook**: URL công khai ngrok + path cố định `/api/payos/webhook`.

---

## Bước 1 — Cài ngrok (Windows)

### Cách A — winget (khuyến nghị)

```powershell
winget install Ngrok.Ngrok
```

Đóng mở lại terminal, kiểm tra:

```bash
ngrok version
```

### Cách B — Tải tay

1. [https://ngrok.com/download](https://ngrok.com/download) → Windows ZIP.
2. Giải nén `ngrok.exe`, thêm thư mục vào **PATH** (hoặc chạy bằng đường dẫn đầy đủ).

---

## Bước 2 — Tài khoản ngrok (free)

1. Đăng ký: [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)
2. Vào **Your Authtoken** → copy token.
3. Gắn máy bạn (chạy **một lần**):

```bash
ngrok config add-authtoken <AUTHTOKEN_CUA_BAN>
```

---

## Bước 3 — Chạy project + tunnel

Cần **2 terminal** (BE đã có sẵn terminal `npm run dev`).

### Terminal 1 — Backend (nếu chưa chạy)

```bash
cd Warehouse_BE_V2
npm run dev
```

Đợi log: `Server is running on port 3000`.

### Terminal 2 — Ngrok

```bash
# Windows: dùng 127.0.0.1 — tránh localhost trỏ process cũ (webhook 404)
ngrok http 127.0.0.1:3000
```

> **Lỗi hay gặp:** `127.0.0.1:3000/api/payos/webhook` → 200 nhưng `localhost:3000/...` → 404  
> → Có **2 app** trên port 3000. Tắt hết Node (`taskkill /F /IM node.exe` nếu cần), chỉ chạy **một** `npm run dev`, ngrok target **127.0.0.1:3000**.

Trên bảng **Forwarding** copy URL HTTPS, ví dụ:

```text
https://a1b2c3d4.ngrok-free.app
```

**Lưu ý:** Mỗi lần tắt/bật lại `ngrok http 3000`, URL free **có thể đổi** → cập nhật lại `.env` + PayOS (bước 4–5).

Kiểm tra API qua tunnel (trình duyệt hoặc curl):

```text
https://a1b2c3d4.ngrok-free.app/api/health
```

Phải trả JSON `status: ok` (có thể có trang cảnh báo ngrok lần đầu — bấm **Visit Site**).

---

## Bước 4 — Cấu hình `.env` (Warehouse_BE_V2)

Mở `Warehouse_BE_V2/.env` (không commit file này).

```env
# PayOS — lấy từ my.payos.vn → Kênh thanh toán
PAYOS_CLIENT_ID=...
PAYOS_API_KEY=...
PAYOS_CHECKSUM_KEY=

# FE local (Vite) — return/cancel sau checkout
PAYOS_RETURN_ORIGIN=http://localhost:5173

# Chỉ dev: domain HTTPS ngrok (KHÔNG có /api/... ở cuối)
PAYOS_WEBHOOK_PUBLIC_URL=https://a1b2c3d4.ngrok-free.app

# Test PayOS với số tiền nhỏ (tối thiểu 1000). Invoice DB vẫn giữ 4.2M — chỉ cổng PayOS hiển thị 2000đ
PAYOS_DEV_AMOUNT=2000
```

**Restart BE** sau khi sửa `.env` (Ctrl+C terminal `npm run dev` → `npm run dev` lại).

Webhook đầy đủ project dùng:

```text
{PAYOS_WEBHOOK_PUBLIC_URL}/api/payos/webhook
```

Ví dụ: `https://a1b2c3d4.ngrok-free.app/api/payos/webhook`

---

## Bước 5 — PayOS (my.payos.vn)

1. Đã có **Kênh thanh toán** + 3 key (Client ID, API Key, Checksum Key).
2. Vào **chi tiết kênh** → **Webhook URL** → dán:

   ```text
   https://a1b2c3d4.ngrok-free.app/api/payos/webhook
   ```

3. Lưu / xác nhận trên PayOS.

### Đăng ký webhook bằng script (tùy chọn)

Khi `.env` đã có `PAYOS_WEBHOOK_PUBLIC_URL` và 3 key PayOS, **BE không bắt buộc chạy** cho lệnh này:

```bash
cd Warehouse_BE_V2
npm run payos:confirm-webhook
```

Script gọi API PayOS `webhooks.confirm` với URL trên. Nếu thành công, PayOS đã gắn webhook cho kênh.

---

## Bước 6 — Frontend

```bash
cd Warehouse_FE_Web/Warehouse_Web_FE
npm run dev
```

Mở `http://localhost:5173` — proxy API về `127.0.0.1:3000` (mặc định trong `vite.config.ts`).

**Swagger:** mở `http://127.0.0.1:3000/api-docs` (không dùng `localhost:3000` — request sẽ trúng BE cũ, thiếu `PENDING_PAYMENT` / PayOS).

---

## Bước 7 — Test end-to-end

| # | Việc | Kỳ vọng |
|---|------|---------|
| 1 | `ngrok` + `npm run dev` đều đang chạy | |
| 2 | Tenant ký HĐ | `PENDING_PAYMENT` |
| 3 | **Thanh toán PayOS** | Mở trang checkout PayOS |
| 4 | Thanh toán thành công | Redirect `/staff/contracts/payment/return` |
| 5 | Vài giây sau | HĐ **ACTIVE** (webhook) |
| 6 | Tạo inbound | Không lỗi “chưa thanh toán” |

Xem log terminal BE khi PayOS gọi webhook — không có lỗi 4xx/5xx trên `/api/payos/webhook`.

**Lỗi `Webhook url invalid (code: 20)`:**

| `curl` / test | Ý nghĩa |
|---------------|---------|
| `404` qua ngrok nhưng `127.0.0.1` OK | Ngrok dùng `localhost` → sai process. Chạy `ngrok http 127.0.0.1:3000` |
| `404` cả hai | BE chưa restart hoặc **ngrok tắt** / URL `.env` sai |
| `400` + body rỗng `{}` | **Bình thường** (chưa có chữ ký) |
| `400` + PayOS gửi chữ ký thật | Sai **Checksum Key** — copy lại từ Kênh thanh toán |

Chẩn đoán tự động:

```bash
npm run payos:test-webhook
```

Phải thấy bước **local-signed → HTTP 200** và **public-signed → HTTP 200** (khi ngrok bật). Sau đó:

```bash
npm run payos:confirm-webhook
```

**Checksum Key:** trên my.payos.vn → **Kênh thanh toán** → **Checksum Key** (không nhầm Client ID / API Key).

---

## Checklist nhanh

- [ ] `ngrok config add-authtoken ...`
- [ ] Terminal 1: `npm run dev` (port 3000)
- [ ] Terminal 2: `ngrok http 3000`
- [ ] `.env`: 3 key PayOS + `PAYOS_RETURN_ORIGIN` + `PAYOS_WEBHOOK_PUBLIC_URL`
- [ ] Restart BE
- [ ] PayOS webhook URL = `{PAYOS_WEBHOOK_PUBLIC_URL}/api/payos/webhook`
- [ ] (Tuỳ chọn) `npm run payos:confirm-webhook`
- [ ] FE `npm run dev` :5173
- [ ] Test thanh toán → HĐ ACTIVE

---

## Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|-------------|-------------|------------|
| PayOS không gọi được webhook | Ngrok tắt / URL cũ | Bật lại ngrok, cập nhật URL mới |
| `/api/health` qua ngrok lỗi | Sai port | `ngrok http 3000` trùng PORT trong `.env` |
| HĐ vẫn chờ thanh toán | Webhook chưa tới BE | Kiểm tra URL có `/api/payos/webhook`, log BE |
| `PayOS chưa cấu hình` | Thiếu key | Điền 3 biến PAYOS_* và restart |
| Đổi URL ngrok mỗi ngày | Free plan | Cập nhật `.env` + PayOS + `npm run payos:confirm-webhook` |

---

## Production

**Không dùng ngrok.** Deploy BE lên server có HTTPS, ví dụ:

```text
https://api.ten-ban.com/api/payos/webhook
```

`PAYOS_WEBHOOK_PUBLIC_URL` chỉ dùng cho dev (script confirm webhook).

---

## Test trên Swagger (`/api-docs`)

Tag **PayOS** — cần **Authorize** JWT (tenant admin):

1. `GET /api/contracts?status=PENDING_PAYMENT` — lấy `contractId`
2. `GET /api/contracts/{contractId}/invoices` — lấy `invoiceId` (INITIAL, PENDING)
3. `POST .../payos/create-link` — copy `checkoutUrl` mở trình duyệt (gọi lại được nếu đã tắt tab / đã hủy — BE tạo order PayOS mới)

**Hủy checkout PayOS:** HĐ vẫn `PENDING_PAYMENT` (đúng — chưa trả tiền). Bấm lại **Thanh toán PayOS** để mở link mới. Hoặc dev: `POST .../mark-paid` (Swagger) bỏ qua cổng.
4. Hoặc dev: `POST .../mark-paid` (không qua PayOS)

`GET /api/payos/webhook` — ping tunnel (không JWT).  
`POST /api/payos/webhook` — PayOS gọi, **không test body rỗng** trên Swagger.

---

## Liên kết

- Nghiệp vụ billing: [contract-billing-termination.md](./contract-billing-termination.md)
- PayOS tạo kênh: [payos.vn — Tạo kênh thanh toán](https://payos.vn/docs/huong-dan-su-dung/tao-kenh-thanh-toan/)
