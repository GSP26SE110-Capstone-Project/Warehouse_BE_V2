-- PayOS: map orderCode ↔ invoice payment
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payos_order_code BIGINT UNIQUE,
  ADD COLUMN IF NOT EXISTS payos_payment_link_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_payments_payos_order_code ON payments (payos_order_code);
