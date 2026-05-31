-- Sync lại bins.current_lpn_count và bins.used_volume_units từ ground truth (lpns table).
--
-- Lý do: trước bản fix `applyBinPutaway` dùng FOR UPDATE, bulk putaway nhiều LPN vào
-- cùng 1 bin trong 1 transaction sẽ ghi đè counter (đọc qua pool.query connection khác,
-- không thấy update chưa commit). Hậu quả: bin chứa N LPN nhưng counter chỉ là 1.
--
-- Script này recompute counter từ lpns.status='STORED' join về bin hiện tại.

BEGIN;

-- 1) Reset toàn bộ
UPDATE bins
SET current_lpn_count = 0,
    used_volume_units = 0;

-- 2) Aggregate từ LPN STORED → set lại counter cho từng bin
UPDATE bins b
SET current_lpn_count = t.lpn_count,
    used_volume_units = t.total_volume
FROM (
  SELECT current_bin_id AS bin_id,
         COUNT(*)::int AS lpn_count,
         COALESCE(SUM(volume_units), 0)::int AS total_volume
  FROM lpns
  WHERE status = 'STORED'
    AND current_bin_id IS NOT NULL
  GROUP BY current_bin_id
) t
WHERE b.bin_id = t.bin_id;

-- 3) Re-derive bin status từ counter mới (giữ nguyên BLOCKED / RESERVED)
UPDATE bins
SET status = CASE
  WHEN status IN ('BLOCKED', 'RESERVED') THEN status
  WHEN used_volume_units >= max_volume_units OR current_lpn_count >= max_lpn_count THEN 'FULL'
  WHEN used_volume_units > 0 OR current_lpn_count > 0 THEN 'PARTIAL'
  ELSE 'EMPTY'
END;

COMMIT;
