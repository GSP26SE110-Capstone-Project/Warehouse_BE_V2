-- Chữ ký số (base64 / data URL) cho hợp đồng hai bên
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS tenant_signature TEXT,
  ADD COLUMN IF NOT EXISTS warehouse_signature TEXT;
