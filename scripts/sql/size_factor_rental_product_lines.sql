-- Size factor catalog + rental request product lines + rental_requests U columns
-- Chạy: node scripts/run-migration.mjs scripts/sql/size_factor_rental_product_lines.sql

DO $do$ BEGIN
  CREATE TYPE size_group_code_enum AS ENUM ('XS_S', 'M_L', 'XL_3XL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;

CREATE TABLE IF NOT EXISTS size_factor_catalog (
  size_group size_group_code_enum PRIMARY KEY,
  display_label VARCHAR(50) NOT NULL,
  factor NUMERIC(4, 2) NOT NULL,
  sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  status catalog_status_enum NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO size_factor_catalog (size_group, display_label, factor, sizes, sort_order)
VALUES
  ('XS_S', 'XS–S', 0.90, '["XS","S"]'::jsonb, 1),
  ('M_L', 'M–L', 1.00, '["M","L"]'::jsonb, 2),
  ('XL_3XL', 'XL–3XL', 1.20, '["XL","XXL","2XL","3XL"]'::jsonb, 3)
ON CONFLICT (size_group) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  factor = EXCLUDED.factor,
  sizes = EXCLUDED.sizes,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

ALTER TABLE rental_requests
  ADD COLUMN IF NOT EXISTS total_committed_volume_units NUMERIC(12, 3),
  ADD COLUMN IF NOT EXISTS box_allocation_json JSONB,
  ADD COLUMN IF NOT EXISTS selected_box_type_hint VARCHAR(20);

CREATE TABLE IF NOT EXISTS rental_request_product_lines (
  line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_request_id UUID NOT NULL REFERENCES rental_requests (rental_request_id) ON DELETE CASCADE,
  product_kind VARCHAR(50) NOT NULL REFERENCES product_kind_catalog (product_kind),
  size VARCHAR(50),
  size_group size_group_code_enum,
  quantity INT NOT NULL CHECK (quantity > 0),
  base_volume_units_per_piece NUMERIC(8, 3) NOT NULL,
  size_factor NUMERIC(4, 2) NOT NULL,
  final_volume_units_per_piece NUMERIC(8, 3) NOT NULL,
  line_volume_units NUMERIC(10, 3) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rr_product_lines_rental_request_id
  ON rental_request_product_lines (rental_request_id);

CREATE INDEX IF NOT EXISTS idx_rr_product_lines_product_kind
  ON rental_request_product_lines (product_kind);
