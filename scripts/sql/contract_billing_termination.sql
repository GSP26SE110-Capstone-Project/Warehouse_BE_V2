-- Billing MONTHLY/YEARLY only, PENDING_PAYMENT, invoice category, termination requests.
-- Run: npm run db:migrate (after adding to run-all-migrations.mjs)

-- 1) Contract status: chờ thanh toán invoice đầu
DO $do$
BEGIN
  ALTER TYPE contract_status_enum ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$do$;

-- 2) Legacy billing cycles → MONTHLY
UPDATE contracts
SET billing_cycle = 'MONTHLY'
WHERE billing_cycle IN ('DAILY', 'QUARTERLY');

-- 3) Invoice category (INITIAL / RECURRING_RENT / OPERATIONAL / TERMINATION)
DO $do$
BEGIN
  CREATE TYPE invoice_category_enum AS ENUM (
    'INITIAL',
    'RECURRING_RENT',
    'OPERATIONAL',
    'TERMINATION_SETTLEMENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$do$;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_category invoice_category_enum DEFAULT 'INITIAL';

CREATE INDEX IF NOT EXISTS idx_invoices_contract_category
  ON invoices (contract_id, invoice_category);

-- 4) Yêu cầu chấm dứt HĐ
DO $do$
BEGIN
  CREATE TYPE termination_request_status_enum AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$do$;

CREATE TABLE IF NOT EXISTS contract_termination_requests (
  termination_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts (contract_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenant_companies (tenant_id),
  requested_by UUID REFERENCES users (user_id),
  status termination_request_status_enum DEFAULT 'PENDING',
  billing_cycle billing_cycle_enum NOT NULL,
  has_inbound BOOLEAN NOT NULL DEFAULT FALSE,
  total_paid NUMERIC(18, 4) NOT NULL DEFAULT 0,
  monthly_rate NUMERIC(18, 4),
  contract_months INT,
  used_months INT,
  unused_months INT,
  processing_fee NUMERIC(18, 4) NOT NULL DEFAULT 0,
  termination_fee NUMERIC(18, 4) NOT NULL DEFAULT 0,
  refund_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  reason TEXT,
  reviewed_by UUID REFERENCES users (user_id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_termination_contract
  ON contract_termination_requests (contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_termination_status
  ON contract_termination_requests (status);
