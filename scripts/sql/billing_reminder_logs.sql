CREATE TABLE IF NOT EXISTS billing_reminder_logs (
  reminder_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_companies(tenant_id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
  billing_due_date DATE NOT NULL,
  reminder_kind VARCHAR(40) NOT NULL DEFAULT 'RECURRING_RENT_3DAY',
  channel VARCHAR(20) NOT NULL DEFAULT 'EMAIL',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contract_id, billing_due_date, reminder_kind, channel)
);

CREATE INDEX IF NOT EXISTS idx_billing_reminder_logs_tenant
  ON billing_reminder_logs (tenant_id, sent_at DESC);
