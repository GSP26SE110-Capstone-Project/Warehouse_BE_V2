-- contact_email unique (case-insensitive) across tenant_companies
CREATE UNIQUE INDEX IF NOT EXISTS tenant_companies_contact_email_key
  ON tenant_companies (LOWER(TRIM(contact_email)))
  WHERE contact_email IS NOT NULL AND TRIM(contact_email) <> '';
