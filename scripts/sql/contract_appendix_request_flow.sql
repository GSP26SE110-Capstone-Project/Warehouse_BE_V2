-- Phụ lục: enum statuses (chạy riêng — PG yêu cầu commit trước khi dùng giá trị enum mới).

DO $do$
BEGIN
  ALTER TYPE contract_appendix_status_enum ADD VALUE IF NOT EXISTS 'PENDING';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$do$;

DO $do$
BEGIN
  ALTER TYPE contract_appendix_status_enum ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$do$;

DO $do$
BEGIN
  ALTER TYPE contract_appendix_status_enum ADD VALUE IF NOT EXISTS 'REJECTED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$do$;
