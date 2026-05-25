-- Move tenant profile from rental_requests to tenant_companies (tenant_id FK only).
-- Run after tenant_companies exists. Backfill tenant_id from company_name match when possible.

ALTER TABLE rental_requests
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenant_companies (tenant_id);

UPDATE rental_requests rr
SET tenant_id = tc.tenant_id
FROM tenant_companies tc
WHERE rr.tenant_id IS NULL
  AND rr.company_name IS NOT NULL
  AND LOWER(TRIM(rr.company_name)) = LOWER(TRIM(tc.company_name));

-- Fail fast if any row still lacks tenant_id before dropping legacy columns.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM rental_requests WHERE tenant_id IS NULL) THEN
    RAISE EXCEPTION
      'rental_requests.tenant_id is NULL for some rows. Create tenant_companies rows and backfill before re-running.';
  END IF;
END $$;

ALTER TABLE rental_requests
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE rental_requests
  DROP COLUMN IF EXISTS company_name,
  DROP COLUMN IF EXISTS company_code,
  DROP COLUMN IF EXISTS tax_code,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS contact_name,
  DROP COLUMN IF EXISTS contact_email,
  DROP COLUMN IF EXISTS contact_phone;

CREATE INDEX IF NOT EXISTS idx_rental_requests_tenant_id ON rental_requests (tenant_id);
