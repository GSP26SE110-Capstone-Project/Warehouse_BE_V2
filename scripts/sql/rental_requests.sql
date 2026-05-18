CREATE TYPE rental_request_status_enum AS ENUM (
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CONVERTED'
);

CREATE TABLE IF NOT EXISTS rental_requests (
  rental_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code VARCHAR UNIQUE,

  company_name VARCHAR,
  company_code VARCHAR,
  tax_code VARCHAR,
  address TEXT,

  contact_name VARCHAR,
  contact_phone VARCHAR,
  contact_email VARCHAR,

  warehouse_id UUID NOT NULL REFERENCES warehouses (warehouse_id),

  contract_type contract_type_enum,
  pricing_model pricing_model_enum,
  billing_cycle billing_cycle_enum,

  requested_capacity DECIMAL,
  notes TEXT,

  status rental_request_status_enum DEFAULT 'PENDING',

  reviewed_by UUID REFERENCES users (user_id),
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,

  created_by UUID REFERENCES users (user_id),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rental_requests_status ON rental_requests (status);
CREATE INDEX IF NOT EXISTS idx_rental_requests_warehouse_id ON rental_requests (warehouse_id);
