Pricing Model Tao Recommend Cho Project
Đây là kiểu pricing:
realistic cho public warehouse ở VN
và:
dễ demo capstone

1. Pricing Philosophy
   Mày đang có:
   warehouse thuê nguyên
   zone thuê riêng
   rack/bin shared
   billing theo usage
   → vậy nên:
   pricing phải theo hierarchy.

2. Tao recommend:
   Storage Level
   Pricing Logic
   Warehouse
   theo m²/tháng
   Zone
   theo m²/tháng
   Rack
   theo rack/day
   Rack Level
   theo level/day
   Bin
   theo box/day

3. Warehouse Pricing
   Dedicated Warehouse
   Nguyên kho

Pricing realistic:
Warehouse Size
Price
nhỏ (~200m²)
25–40 triệu/tháng
vừa (~500m²)
60–120 triệu/tháng
lớn (1000m²+)
150–300 triệu/tháng

Tao recommend capstone:
180,000 VNĐ / m² / tháng

Ví dụ:
500m²:
500 × 180,000
= 90 triệu / tháng

4. Zone Pricing
   Dedicated Zone

Pricing:
120,000–300,000 VNĐ / m² / tháng

10tr050 / zone / tháng (tùy theo warehouseSize mà sl zone khác nhau)

Vì:
zone thường:
premium hơn
gần outbound hơn
optimized hơn

Tao recommend:
Zone Type
Price/m²/month
SHARED
120k
FAST_MOVING
220k
PREMIUM
250k
PRIVATE
200k

5. Rack Pricing

   Dưới đây là trường mới của rental_requests, dựa vào đây mới đánh giá được nên chọn rack nào

Pricing theo:
rack/day

Tao recommend:
Rack Type
Price
STANDARD
120k/day
HIGH_CAPACITY
200k/day

6. Rack Level Pricing

Tao recommend:
Level
Price/day
lower level
60k
middle level
50k
upper level
40k

Vì:
lower level:
pick dễ hơn

7. Bin Pricing
   Đây là core của project mày 😄

Theo:
box/day

Tao recommend (flat /tháng — nguồn gốc billing):
Box Type
Price/thùng/month
SMALL
10k
MEDIUM
15k
LARGE
25k
EXTRA
45k

BOX_DAY (prorate): round(giá_tháng / 30) — SMALL ~333 ₫/ngày, MEDIUM 500, LARGE 833, EXTRA 1.500.

8. Fast Moving Surcharge

Nếu:
SKU:
FAST_MOVING

→ cộng:
+20% ~ +40%

Vì:
picking nhiều
labor nhiều
near outbound space expensive

9. Premium Zone Pricing

Luxury fashion:
Feature
Extra Cost
humidity control
+20%
camera/security
+15%
restricted access
+10%

10. Shared Storage Pricing

Đây là:
dynamic pricing — tenant dùng bao nhiêu (box/rack thực tế) tính bấy nhiêu **trong cả kỳ hóa đơn**.

**Capstone / guest form:** chu kỳ **MONTHLY** hoặc **YEARLY** (không chọn billing theo ngày).

Cách tính gợi ý (một hóa đơn cuối kỳ, không snapshot từng ngày trên UI guest):

Ví dụ tháng 30 ngày, mức sử dụng trung bình:

- Nửa đầu tháng ~10 EXTRA
- Nửa sau ~5 EXTRA
  → Có thể ghi nhận **mức trung bình ~7–8 EXTRA** cho kỳ, hoặc peak tùy policy hợp đồng.

Billing tháng (minh họa):
(7.5 EXTRA × 50k × 30 ngày tương đương) ≈ **11.25 triệu / tháng**

Hoặc đơn giản hóa capstone:
`phí kỳ = đơn giá tham chiếu × mức sử dụng trung bình trong kỳ`

→ **usage-based**, nhưng **tổng hợp theo tháng/năm**, không bảng Day 1–15 / 16–30 trên landing.

11. Reserved Storage Pricing

Tenant:
reserve trước capacity

Dù dùng hay không:
vẫn trả.

Ví dụ:
reserve:
10 EXTRA

actual:
5 EXTRA

→ vẫn bill:
10 EXTRA

Vì warehouse đã giữ slot.

12. Dedicated Zone Pricing

Công thức:
area × zone rate

Ví dụ:
50m² × 220k
=
11 triệu/tháng

13. Dedicated Warehouse Pricing

Công thức:
warehouse area × warehouse rate

14. Handling Fee (thu trước — OPERATIONAL invoice)

| Operation           | Fee (VNĐ)                                   |
| ------------------- | ------------------------------------------- |
| Inbound LPN SMALL   | 2.000 / LPN                                 |
| Inbound LPN MEDIUM  | 3.000 / LPN                                 |
| Inbound LPN LARGE   | 5.000 / LPN                                 |
| Inbound LPN EXTRA   | 8.000 / LPN                                 |
| Outbound LPN        | Cùng bảng inbound                           |
| WAREHOUSE_TRANSPORT | 250.000 / chuyến (cùng city + district kho) |
| repacking           | 10.000 (tùy chọn phase sau)                 |
| QC inspection       | 5.000                                       |
| relocation          | 3.000                                       |

Storage fee ≠ handling fee. Phụ phí **không** dồn sang invoice thuê tháng sau.

15. Pricing Table Final
    Level
    Unit
    Suggested Price
    Warehouse
    m²/month
    180k
    Shared Zone
    m²/month
    120k
    Fast Moving Zone
    m²/month
    220k
    Premium Zone
    m²/month
    250k
    Private Zone
    m²/month
    200k
    Bulk Zone
    m²/month
    100k
    Rack STANDARD
    rack/day
    120k
    Rack HIGH_CAPACITY
    rack/day
    200k
    Rack Level
    level/day
    40k–60k
    SMALL
    thùng/month
    10k
    MEDIUM
    thùng/month
    15k
    LARGE
    thùng/month
    25k
    EXTRA
    thùng/month
    45k

16. Default capstone flow (MONTHLY only)

- SHARED_STORAGE / RESERVED_STORAGE / DEDICATED_ZONE / DEDICATED_WAREHOUSE: hóa đơn **MONTHLY**
- INITIAL = tháng đầu; RECURRING_RENT hàng tháng theo ngày `startDate`
- OPERATIONAL = prepaid khi tạo inbound/outbound
