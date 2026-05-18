-- Chạy sau rental_requests đã tồn tại
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS rental_request_id UUID UNIQUE REFERENCES rental_requests (rental_request_id);

CREATE INDEX IF NOT EXISTS idx_contracts_rental_request_id ON contracts (rental_request_id);
