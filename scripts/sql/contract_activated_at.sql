-- Ngày HĐ ACTIVE (invoice INITIAL PAID) — mốc thanh toán định kỳ hàng tháng.
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- Backfill HĐ đã ACTIVE từ invoice INITIAL đã PAID.
UPDATE contracts c
SET activated_at = sub.paid_at
FROM (
  SELECT
    c2.contract_id,
    COALESCE(pay.paid_at, i.updated_at, i.issued_at, c2.updated_at) AS paid_at
  FROM contracts c2
  INNER JOIN invoices i
    ON i.contract_id = c2.contract_id
   AND i.invoice_category = 'INITIAL'
   AND i.payment_status = 'PAID'
  LEFT JOIN LATERAL (
    SELECT p.paid_at
    FROM payments p
    WHERE p.invoice_id = i.invoice_id
      AND p.payment_status = 'SUCCESS'
    ORDER BY p.paid_at DESC NULLS LAST
    LIMIT 1
  ) pay ON TRUE
  WHERE c2.status IN ('ACTIVE', 'TERMINATED', 'EXPIRED')
) sub
WHERE c.contract_id = sub.contract_id
  AND c.activated_at IS NULL;
