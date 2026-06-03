-- Contract appendices (phụ lục): extend ACTIVE contracts within storage ceiling.
-- Run via: npm run db:migrate:all

DO $do$
BEGIN
  CREATE TYPE contract_appendix_status_enum AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'PENDING_PAYMENT',
    'ACTIVE',
    'TERMINATED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$do$;

CREATE TABLE IF NOT EXISTS contract_appendices (
  appendix_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts (contract_id) ON DELETE CASCADE,
  appendix_code VARCHAR(100) NOT NULL UNIQUE,
  appendix_number INT NOT NULL DEFAULT 1,
  title VARCHAR(255),
  status contract_appendix_status_enum DEFAULT 'DRAFT',
  effective_date DATE NOT NULL,
  end_date DATE NOT NULL,
  estimated_delta_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  max_storage_level storage_level_enum,
  tenant_signature TEXT,
  warehouse_signature TEXT,
  created_by UUID REFERENCES users (user_id),
  approved_by UUID REFERENCES users (user_id),
  terminated_at TIMESTAMPTZ,
  termination_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT contract_appendices_dates_chk CHECK (end_date > effective_date)
);

CREATE INDEX IF NOT EXISTS idx_contract_appendices_contract
  ON contract_appendices (contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_appendices_status
  ON contract_appendices (status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_appendices_contract_number
  ON contract_appendices (contract_id, appendix_number);

ALTER TABLE contract_items
  ADD COLUMN IF NOT EXISTS appendix_id UUID REFERENCES contract_appendices (appendix_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contract_items_appendix
  ON contract_items (appendix_id);

ALTER TABLE storage_reservations
  ADD COLUMN IF NOT EXISTS appendix_id UUID REFERENCES contract_appendices (appendix_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_storage_reservations_appendix
  ON storage_reservations (appendix_id);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS appendix_id UUID REFERENCES contract_appendices (appendix_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_appendix
  ON invoices (appendix_id);

DO $do$
BEGIN
  ALTER TYPE invoice_category_enum ADD VALUE IF NOT EXISTS 'APPENDIX_INITIAL';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$do$;
