# Pricing Model v2 — Warehouse Rental System

Tài liệu tham chiếu chính thức cho capstone: realistic cho public warehouse ở VN, đồng bộ với enum / service trong codebase.

**Nguồn code:** `src/constants/rentalPricingDefaults.js`, `src/constants/pricingDefaults.js`, `src/constants/tenantOnboarding.js`, `src/services/contractPriceEstimate.service.js`

---

## 1. Triết lý pricing

Hệ thống có **5 mức lưu trữ vật lý** và **5 loại hợp đồng thuê** (contract type). Giá phải phản ánh hierarchy:

| Storage Level | Đơn vị tính phí | Ghi chú |
|---------------|-----------------|---------|
| `WAREHOUSE` | m²/tháng | Thuê nguyên kho |
| `ZONE` | m²/tháng | Thuê riêng một hoặc nhiều zone |
| `RACK` | rack/ngày | Chỉ `STANDARD` (kho quần áo) |
| `RACK_LEVEL` | level/ngày | Cố định 3 tầng/rack |
| `BIN` | box/ngày | `SMALL` · `MEDIUM` · `LARGE` · `EXTRA` |

**Nguyên tắc phân tầng giá:**

- Thuê **nguyên kho** → cam kết lớn → **rẻ nhất theo m²**
- Thuê **nguyên zone** → dùng chung hạ tầng kho → **đắt hơn warehouse theo m²**
- **Shared storage** (usage) → linh hoạt nhất → tính theo thùng thực tế
- **Reserved storage** → giữ capacity cố định → trả dù chưa dùng hết

---

## 2. Loại hợp đồng (`contractType`)

| Contract Type | Pricing Model | Billing Cycle (guest) | Mô tả |
|---------------|---------------|------------------------|-------|
| `SHARED_STORAGE` | `USAGE_BASED` | `MONTHLY` / `YEARLY` | Kho chia sẻ — trả theo mức dùng thùng |
| `RESERVED_STORAGE` | `FIXED` hoặc `HYBRID` | `MONTHLY` / `YEARLY` | Giữ chỗ capacity cố định |
| `DEDICATED_ZONE` | `FIXED` | `MONTHLY` / `YEARLY` | Thuê riêng zone theo m² |
| `DEDICATED_WAREHOUSE` | `FIXED` | `MONTHLY` / `YEARLY` | Thuê nguyên warehouse theo m² |
| `NEEDS_CONSULTATION` | — | — | Khách chưa chọn — WH Admin gán loại khi duyệt |

**Billing unit hỗ trợ trên hợp đồng:** `BOX_DAY`, `BIN_DAY`, `RACK_DAY`, `ZONE_DAY`, `WAREHOUSE_DAY`, `INBOUND_LPN`, `OUTBOUND_LPN`, `HANDLING_UNIT`

**Chu kỳ hóa đơn:** `DAILY` · `MONTHLY` · `QUARTERLY` · `YEARLY` — guest form dùng `MONTHLY` hoặc `YEARLY`.

**Quy ước tháng:** `DAYS_PER_BILLING_MONTH = 30`

---

## 3. Thuê nguyên Warehouse — `DEDICATED_WAREHOUSE`

### Đơn giá

| Hạng mục | Đơn giá |
|----------|---------|
| Warehouse (toàn bộ kho) | **120.000 ₫ / m² / tháng** |

### Công thức

```
monthlyAmount = areaM2 × 120_000
suggestedTotalAmount = monthlyAmount × monthCount
```

**Diện tích dùng để tính (theo thứ tự ưu tiên):**

1. `requestedAreaM2` trên rental request
2. `usableAreaM2` từ zone planning
3. `usableAreaM2` / `totalAreaM2` của warehouse

### Ví dụ

| Diện tích | Phí/tháng |
|-----------|-----------|
| 200 m² | 24.000.000 ₫ |
| 500 m² | 60.000.000 ₫ |
| 1.000 m² | 120.000.000 ₫ |

### Band tham khảo thị trường VN

| Quy mô | Diện tích | Band thị trường |
|--------|-----------|----------------|
| Nhỏ | ~200 m² | 25–40 triệu/tháng |
| Vừa | ~500 m² | 60–120 triệu/tháng |
| Lớn | 1.000 m²+ | 150–300 triệu/tháng |

---

## 4. Thuê nguyên Zone — `DEDICATED_ZONE`

### Loại zone (`zoneType`)

| Zone Type | Đơn giá (m²/tháng) | Đặc điểm |
|-----------|-------------------|----------|
| `SHARED` | **140.000 ₫** | Khu lưu hàng chung — kho xếp hàng lên kệ/ngăn |
| `FAST_MOVING` | **220.000 ₫** | Gần outbound, hàng luân chuyển nhanh |
| `PREMIUM` | **300.000 ₫** | Kiểm soát môi trường, bảo mật cao |
| `PRIVATE` | **250.000 ₫** | Khu riêng tách biệt tenant |

> **Lưu ý:** Zone `SHARED` (140k) **cao hơn** thuê nguyên warehouse (120k) vì tenant dùng chung dock, WMS, bảo vệ và vận hành kho — phản ánh đúng hierarchy giá.

### Công thức

**Đã chọn zone cụ thể (`zoneIds`):**

```
monthlyAmount = Σ (zone.areaM2 × rate(zone.zoneType))
unitPricePerM2Month = monthlyAmount / totalAreaM2   // trung bình có trọng số
```

**Chưa chọn zone (ước tính sơ bộ):**

```
monthlyAmount = requestedAreaM2 × rate(suggestedZoneType)
// fallback diện tích: suggestedAreaPerZoneForEvenSplit hoặc REFERENCE_ZONE_AREA_M2 (50 m²)
```

**Rate khi có yêu cầu đặc biệt trên rental request:**

- `requiresPremiumStorage = true` và zone không phải `PREMIUM` / `PRIVATE` → `rate × 1.2` (`PREMIUM_STORAGE_SURCHARGE_RATIO`)
- `requiresFastPicking = true` → ưu tiên `FAST_MOVING` nếu chưa có `suggestedZoneType`

### Ví dụ

| Zone | Diện tích | Đơn giá | Phí/tháng |
|------|-----------|---------|-----------|
| SHARED | 50 m² | 140.000 | 7.000.000 ₫ |
| FAST_MOVING | 50 m² | 220.000 | 11.000.000 ₫ |
| PREMIUM | 30 m² | 300.000 | 9.000.000 ₫ |
| SHARED + FAST_MOVING | 50 + 30 m² | mixed | 50×140k + 30×220k = **13.600.000 ₫** |

### Capacity zone (tham chiếu vật lý)

Từ `warehouseCapacity.js`:

- `ZONE_AISLE_RATIO = 0.30` — 30% diện tích zone là lối đi
- `RACK_FOOTPRINT_M2 = 3` — mỗi rack STANDARD chiếm 3 m²
- `RACK_FIXED_LEVEL_COUNT = 3` — 3 tầng/rack
- `BIN_SLOT_FOOTPRINT_M2 = 0.25` — 1 ô bin ≈ 0.25 m²

---

## 5. Kho chia sẻ — `SHARED_STORAGE`

Mô hình **usage-based**: tenant trả theo mức sử dụng thùng thực tế trong kỳ hóa đơn, **tổng hợp theo tháng/năm** (không snapshot từng ngày trên UI guest).

### Đơn giá box/ngày (`STORAGE` · `BOX_DAY` · `BIN`)

| Box Type | Giá/ngày | Volume units |
|----------|----------|--------------|
| `SMALL` | 10.000 ₫ | 1 |
| `MEDIUM` | 20.000 ₫ | 2 |
| `LARGE` | 35.000 ₫ | 4 |
| `EXTRA` | 50.000 ₫ | 8 |

### Ước tính onboarding (chưa có hợp đồng chi tiết)

Service dùng **giá trung bình** khi guest chưa chọn box type:

```
SHARED_STORAGE_AVG_BOX_DAY = 20_000   // ≈ MEDIUM
monthlyAmount = estimatedBoxCount × 20_000 × 30
```

Nếu không khai báo số thùng → mặc định `estimatedBoxCount = 10`.

### Công thức billing thực tế (cuối kỳ)

```
phí_kỳ = Σ (boxTypeDayPrice[boxType] × avgBoxesUsed[boxType] × daysInPeriod)
```

**Ví dụ tháng 30 ngày** — mức trung bình ~7,5 EXTRA:

```
7.5 × 50.000 × 30 ≈ 11.250.000 ₫ / tháng
```

**Đơn giản hóa capstone:**

```
phí_kỳ = đơn_giá_tham_chiếu × mức_sử_dụng_trung_bình_trong_kỳ
```

### So sánh với thuê zone

| Nhu cầu | Gợi ý mô hình |
|---------|---------------|
| ~10–20 thùng, linh hoạt | `SHARED_STORAGE` |
| Giữ chỗ 50 thùng dù chỉ dùng 30 | `RESERVED_STORAGE` |
| Cần ~50 m² riêng, cố định | `DEDICATED_ZONE` SHARED |
| Cần toàn bộ kho 500 m² | `DEDICATED_WAREHOUSE` |

---

## 6. Giữ chỗ — `RESERVED_STORAGE`

Tenant **reserve trước capacity** — dù dùng hay không vẫn trả, vì kho đã giữ slot.

### Cách tính (theo thứ tự ưu tiên trong `contractPriceEstimate`)

**1. Theo diện tích (`requestedAreaM2`):**

```
monthlyAmount = requestedAreaM2 × 140_000   // rate SHARED zone
```

**2. Theo số thùng giữ (`estimatedBoxCount`):**

```
monthlyAmount = estimatedBoxCount × 20_000 × 30
```

**3. Ước tính khi thiếu dữ liệu:**

```
monthlyAmount = remainingZoneAreaM2 × 140_000
// fallback: REFERENCE_ZONE_AREA_M2 = 50 m²
```

### Ví dụ

| Kịch bản | Tính phí |
|----------|----------|
| Reserve 10 EXTRA, actual 5 EXTRA | Bill **10 EXTRA** |
| Reserve 50 m² SHARED | 50 × 140.000 = **7.000.000 ₫/tháng** |
| Reserve 30 thùng (avg) | 30 × 20.000 × 30 = **18.000.000 ₫/tháng** |

---

## 7. Chưa chọn hình thức — `NEEDS_CONSULTATION`

- Guest submit form chưa chọn `contractType`
- Warehouse Admin chọn loại thuê phù hợp khi duyệt
- API estimate trả `monthlyAmount = 0`, `basisLabel = "Chờ tư vấn"`
- `requestedAreaM2` (nếu có) chỉ hiển thị tham khảo, **chưa tính phí**

---

## 8. Rack & Rack Level (chi tiết trong shared / zone)

Dự án kho quần áo: chỉ rack `STANDARD`, cố định **3 tầng/rack**.

### Rack

| Rack Type | Đơn giá |
|-----------|---------|
| `STANDARD` | **120.000 ₫ / rack / ngày** |

```
phí_kỳ = rackDayPrice × tổng_rack-day_trong_kỳ
```

### Rack Level

| Level | Giá/ngày | Lý do |
|-------|----------|-------|
| Lower (tầng dưới) | 60.000 ₫ | Dễ pick |
| Middle (tầng giữa) | 50.000 ₫ | Cân bằng |
| Upper (tầng trên) | 40.000 ₫ | Chi phí thấp, hàng ít luân chuyển |

---

## 9. Reservation trên bin (`reservationType`)

| Type | Ý nghĩa |
|------|---------|
| `SHARED` | Bin dùng chung multi-tenant |
| `RESERVED` | Bin giữ cho tenant cụ thể |
| `DEDICATED` | Bin thuộc riêng tenant (thường trong dedicated zone) |

---

## 10. Phụ phí (Surcharge)

### Fast Moving SKU

Nếu SKU có `movementCategory = FAST` hoặc rental request `requiresFastPicking`:

```
+20% ~ +40% trên phí lưu trữ
```

### Premium Zone features

| Feature | Phụ phí |
|---------|---------|
| Humidity control | +20% |
| Camera / Security | +15% |
| Restricted access | +10% |

Áp dụng khi `requiresPremiumStorage = true` trên zone không phải `PREMIUM`/`PRIVATE` → hệ số **×1.2** trong code estimate.

---

## 11. Handling Fee (tách khỏi storage fee)

Storage fee ≠ handling fee. Warehouse thật luôn tách hai khoản này.

### Inbound LPN (theo box type)

| Box Type | Giá/LPN |
|----------|---------|
| `SMALL` | 10.000 ₫ |
| `MEDIUM` | 20.000 ₫ |
| `LARGE` | 35.000 ₫ |
| `EXTRA` | 50.000 ₫ |

### Outbound & vận hành

| Operation | Fee |
|-----------|-----|
| Outbound LPN | 7.000 – 20.000 ₫ |
| Repacking | 10.000 ₫ |
| QC Inspection | 5.000 ₫ |
| Relocation | 3.000 ₫ |
| Handling unit (fallback) | 10.000 ₫ |

Contract mới seed qua `buildDefaultContractItemRows()` trong `pricingDefaults.js`.

---

## 12. Bảng giá tổng hợp (Pricing Table Final)

| Level | Unit | Contract Type | Giá đề xuất |
|-------|------|---------------|-------------|
| Warehouse | m²/month | `DEDICATED_WAREHOUSE` | **120.000 ₫** |
| Zone SHARED | m²/month | `DEDICATED_ZONE` | **140.000 ₫** |
| Zone FAST_MOVING | m²/month | `DEDICATED_ZONE` | **220.000 ₫** |
| Zone PREMIUM | m²/month | `DEDICATED_ZONE` | **300.000 ₫** |
| Zone PRIVATE | m²/month | `DEDICATED_ZONE` | **250.000 ₫** |
| Shared storage (avg) | box/day | `SHARED_STORAGE` | **20.000 ₫** (≈ MEDIUM) |
| SMALL box | box/day | `SHARED_STORAGE` | **10.000 ₫** |
| MEDIUM box | box/day | `SHARED_STORAGE` | **20.000 ₫** |
| LARGE box | box/day | `SHARED_STORAGE` | **35.000 ₫** |
| EXTRA box | box/day | `SHARED_STORAGE` | **50.000 ₫** |
| Reserved (theo m²) | m²/month | `RESERVED_STORAGE` | **140.000 ₫** (SHARED rate) |
| Rack STANDARD | rack/day | usage trong zone | **120.000 ₫** |
| Rack Level | level/day | usage | **40.000 – 60.000 ₫** |

---

## 13. Flow capstone mặc định

```
Guest form
  ├─ SHARED_STORAGE      → usage-based, MONTHLY/YEARLY
  ├─ RESERVED_STORAGE    → fixed reserved, MONTHLY/YEARLY
  ├─ DEDICATED_ZONE      → fixed theo m², MONTHLY/YEARLY
  ├─ DEDICATED_WAREHOUSE → fixed theo m², MONTHLY/YEARLY
  └─ NEEDS_CONSULTATION  → WH Admin gán loại khi duyệt

Onboarding estimate API
  POST .../rental-requests/:id/price-estimate
  Query: warehouseId, zoneIds[], contractType?

Approval → Contract → ContractItems (pricingDefaults seed)
  → Inbound estimate dùng contract_items hoặc fallback docs
```

---

## 14. Ví dụ so sánh hierarchy (500 m² kho, tenant cần ~50 m²)

| Mô hình | Công thức | Phí/tháng |
|---------|-----------|-----------|
| Shared storage ~10 MEDIUM | 10 × 20k × 30 | **6.000.000 ₫** |
| Reserved 50 m² | 50 × 140k | **7.000.000 ₫** |
| Dedicated zone SHARED 50 m² | 50 × 140k | **7.000.000 ₫** |
| Dedicated warehouse 500 m² | 500 × 180k | **90.000.000 ₫** |
| Dedicated zone FAST 50 m² | 50 × 220k | **11.000.000 ₫** |

→ Tenant cần diện tích lớn (vd. >400 m²) sẽ có động lực chuyển sang **thuê nguyên kho** (180k/m²) thay vì nhiều zone SHARED (140k/m²).

---

## 15. Mapping constants (cần đồng bộ code)

| Constant | File | Giá trị v2 |
|----------|------|------------|
| `WAREHOUSE_PRICE_PER_M2_MONTH` | `rentalPricingDefaults.js` | `180_000` |
| `ZONE_PRICE_PER_M2_MONTH.SHARED` | `rentalPricingDefaults.js` | `120_000` |
| `ZONE_PRICE_PER_M2_MONTH.FAST_MOVING` | `rentalPricingDefaults.js` | `220_000` |
| `ZONE_PRICE_PER_M2_MONTH.PREMIUM` | `rentalPricingDefaults.js` | `250_000` |
| `ZONE_PRICE_PER_M2_MONTH.PRIVATE` | `rentalPricingDefaults.js` | `200_000` |
| `SHARED_STORAGE_AVG_BOX_MONTH` | `rentalPricingDefaults.js` | `23_750` |
| `SHARED_STORAGE_AVG_BOX_DAY` | `rentalPricingDefaults.js` | `792` (round) |
| `STORAGE_BOX_MONTH_PRICE_BY_BOX_TYPE` | `pricingDefaults.js` | 10k / 15k / 25k / 45k |
| `STORAGE_BOX_DAY_PRICE_BY_BOX_TYPE` | `pricingDefaults.js` | round(month/30) |
| `INBOUND_LPN_PRICE_BY_BOX_TYPE` | `pricingDefaults.js` | 10k / 20k / 35k / 50k |
| `PREMIUM_STORAGE_SURCHARGE_RATIO` | `rentalPricingDefaults.js` | `1.2` |
| `DAYS_PER_BILLING_MONTH` | cả hai file | `30` |

**Frontend:** `Warehouse_Web_FE/src/data/pricing.ts` — `WAREHOUSE_PRICING` 180k, `ZONE_PRICING` Premium 250k / Private 200k, `BOX_MONTH_PRICING` flat 10k/15k/25k/45k.

---

## 16. Thay đổi so với `pricing.md` v1

| Hạng mục | v1 | v3 (hiện tại) |
|----------|----|----|
| Warehouse | 120.000 ₫/m² | **180.000 ₫/m²** |
| Premium zone | 300.000 ₫/m² | **250.000 ₫/m²** |
| Private zone | 250.000 ₫/m² | **200.000 ₫/m²** |
| Box SMALL/tháng | 300k (10k×30) | **10.000 ₫** flat |
| Box MEDIUM/tháng | 600k | **15.000 ₫** |
| Box LARGE/tháng | 1.050k | **25.000 ₫** |
| Box EXTRA/tháng | 1.500k | **45.000 ₫** |
