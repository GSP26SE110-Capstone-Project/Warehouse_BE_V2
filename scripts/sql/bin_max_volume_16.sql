-- Tăng volume/bin: 1 bin vẫn max 4 LPN nhưng chứa tối đa 2 EXTRA (8+8 volume).
UPDATE bins
SET max_volume_units = 16
WHERE max_volume_units < 16;
