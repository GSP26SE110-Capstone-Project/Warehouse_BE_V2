-- Thêm loại "chưa rõ / để kho tư vấn" trên yêu cầu thuê (rental_requests).
-- Chạy trên DB đã có: docker exec -i <pg> psql -U ... -d ... < scripts/sql/contract_type_needs_consultation.sql

DO $do$
BEGIN
  ALTER TYPE contract_type_enum ADD VALUE IF NOT EXISTS 'NEEDS_CONSULTATION';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$do$;
