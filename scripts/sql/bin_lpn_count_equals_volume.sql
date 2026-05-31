-- Bin: chỉ chặn bởi volume, không chặn bởi LPN count.
--
-- Lý do: mỗi SMALL = 1 volume unit nên upper bound vật lý của số LPN trong 1 bin
-- = số volume units. Nếu max_lpn_count < max_volume_units, bin sẽ bị cap LPN khi
-- tenant nhập nhiều box nhỏ (ví dụ vol=16 nhưng max_lpn=4: 1 EXTRA + 1 LARGE +
-- 1 MEDIUM + 2 SMALL = 16 vol nhưng 5 LPN > 4 → bị chặn dù bin chưa đầy volume).
--
-- Sau migration: bin có thể chứa mọi tổ hợp box type miễn tổng volume ≤ max_volume_units.

UPDATE bins
SET max_lpn_count = max_volume_units
WHERE max_lpn_count < max_volume_units;
