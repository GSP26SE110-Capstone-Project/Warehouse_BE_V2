-- LPN gross/net weight (kg) for rack type & level capacity checks
ALTER TABLE lpns
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(18, 4);

COMMENT ON COLUMN lpns.weight_kg IS 'Measured carton weight in kg (receiving / putaway)';
