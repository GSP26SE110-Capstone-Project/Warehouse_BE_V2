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
120,000 VNĐ / m² / tháng

Ví dụ:
500m²:
500 × 120,000
= 60 triệu / tháng

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
120k  -> 140k
FAST_MOVING
220k
PREMIUM
300k
PRIVATE
250k


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

Tao recommend:
Box Type
Suggested Price/day
SMALL
10k
MEDIUM
20k
LARGE
35k
EXTRA
50k


Đây khá realistic.

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

14. Handling Fee
Tao recommend thêm

Operation
Fee
inbound LPN
5k–15k
outbound LPN
7k–20k
repacking
10k
QC inspection
5k
relocation
3k


Vì warehouse thật:
storage fee ≠ handling fee.

15. Pricing Table Final
Level
Unit
Suggested Price
Warehouse
m²/month
120k
Shared Zone
m²/month
120k
Fast Moving Zone
m²/month
220k
Premium Zone
m²/month
300k
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
box/day
10k
MEDIUM
box/day
20k
LARGE
box/day
35k
EXTRA
box/day
50k


16. Tao recommend:
default capstone flow

SHARED_STORAGE
usage-based — hóa đơn MONTHLY / YEARLY

RESERVED_STORAGE
fixed reserved — hóa đơn MONTHLY / YEARLY

DEDICATED_ZONE
fixed — theo m², MONTHLY / YEARLY

DEDICATED_WAREHOUSE
fixed — theo m², MONTHLY / YEARLY

