-- Phụ lục: cột yêu cầu + chuyển DRAFT → PENDING (chạy sau contract_appendix_request_flow.sql).

UPDATE contract_appendices SET status = 'PENDING' WHERE status = 'DRAFT';

ALTER TABLE contract_appendices
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES users (user_id),
  ADD COLUMN IF NOT EXISTS requested_storage_level storage_level_enum,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS review_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users (user_id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE contract_appendices
  ALTER COLUMN estimated_delta_amount SET DEFAULT 0;
