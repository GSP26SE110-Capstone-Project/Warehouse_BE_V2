-- Move tenant profile from rental_requests to tenant_companies (tenant_id FK only).
-- Legacy upgrade when company_name* columns exist. No-op when db4_schema already has tenant_id NOT NULL.

ALTER TABLE rental_requests
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenant_companies (tenant_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rental_requests'
      AND column_name = 'company_name'
  ) THEN
    UPDATE rental_requests rr
    SET tenant_id = tc.tenant_id
    FROM tenant_companies tc
    WHERE rr.tenant_id IS NULL
      AND rr.company_name IS NOT NULL
      AND LOWER(TRIM(rr.company_name)) = LOWER(TRIM(tc.company_name));

    IF EXISTS (SELECT 1 FROM rental_requests WHERE tenant_id IS NULL) THEN
      RAISE EXCEPTION
        'rental_requests.tenant_id is NULL for some rows. Create tenant_companies rows and backfill before re-running.';
    END IF;

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
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rental_requests'
      AND column_name = 'tenant_id'
      AND is_nullable = 'YES'
  ) THEN
    IF EXISTS (SELECT 1 FROM rental_requests WHERE tenant_id IS NULL) THEN
      RAISE EXCEPTION
        'rental_requests.tenant_id is NULL for some rows. Backfill tenant_id before re-running.';
    END IF;
    ALTER TABLE rental_requests
      ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rental_requests_tenant_id ON rental_requests (tenant_id);
