-- Garment category groups (TOPS/BOTTOMS/…) + product kind catalog (T_SHIRT, JEANS, …)
-- Chạy: node scripts/run-migration.mjs scripts/sql/garment_category_product_kind_catalog.sql

DO $do$ BEGIN
  CREATE TYPE garment_group_code_enum AS ENUM ('TOPS', 'BOTTOMS', 'DRESSES', 'OUTERWEAR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;

DO $do$ BEGIN
  CREATE TYPE catalog_status_enum AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;

CREATE TABLE IF NOT EXISTS garment_category_groups (
  group_code garment_group_code_enum PRIMARY KEY,
  display_name_vi VARCHAR(100) NOT NULL,
  display_name_en VARCHAR(100),
  sort_order INT NOT NULL DEFAULT 0,
  status catalog_status_enum NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_kind_catalog (
  product_kind VARCHAR(50) PRIMARY KEY,
  group_code garment_group_code_enum NOT NULL REFERENCES garment_category_groups (group_code),
  display_name VARCHAR(100) NOT NULL,
  base_volume_units_per_piece NUMERIC(6, 3) NOT NULL,
  has_size BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  status catalog_status_enum NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_kind_catalog_group_code
  ON product_kind_catalog (group_code);

CREATE INDEX IF NOT EXISTS idx_product_kind_catalog_status
  ON product_kind_catalog (status);

-- Seed groups (doc rental-volume-units-flow.md C1)
INSERT INTO garment_category_groups (group_code, display_name_vi, display_name_en, sort_order)
VALUES
  ('TOPS', 'Áo', 'Tops', 1),
  ('BOTTOMS', 'Quần', 'Bottoms', 2),
  ('DRESSES', 'Váy', 'Dresses', 3),
  ('OUTERWEAR', 'Khoác', 'Outerwear', 4)
ON CONFLICT (group_code) DO UPDATE SET
  display_name_vi = EXCLUDED.display_name_vi,
  display_name_en = EXCLUDED.display_name_en,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Seed product kinds (doc C2 — Base U for size M–L)
INSERT INTO product_kind_catalog (
  product_kind,
  group_code,
  display_name,
  base_volume_units_per_piece,
  has_size,
  sort_order
)
VALUES
  ('T_SHIRT', 'TOPS', 'T-Shirt', 0.500, TRUE, 1),
  ('POLO', 'TOPS', 'Polo', 0.500, TRUE, 2),
  ('SHIRT', 'TOPS', 'Shirt', 0.750, TRUE, 3),
  ('BLOUSE', 'TOPS', 'Blouse', 0.750, TRUE, 4),
  ('JEANS', 'BOTTOMS', 'Jeans', 1.000, TRUE, 1),
  ('TROUSERS', 'BOTTOMS', 'Trousers', 1.000, TRUE, 2),
  ('SHORTS', 'BOTTOMS', 'Shorts', 0.750, TRUE, 3),
  ('SKIRT', 'BOTTOMS', 'Skirt', 0.750, TRUE, 4),
  ('MINI_DRESS', 'DRESSES', 'Mini Dress', 1.000, TRUE, 1),
  ('MIDI_DRESS', 'DRESSES', 'Midi Dress', 1.250, TRUE, 2),
  ('MAXI_DRESS', 'DRESSES', 'Maxi Dress', 1.500, TRUE, 3),
  ('HOODIE', 'OUTERWEAR', 'Hoodie', 1.500, TRUE, 1),
  ('JACKET', 'OUTERWEAR', 'Jacket', 2.000, TRUE, 2),
  ('COAT', 'OUTERWEAR', 'Coat', 3.000, TRUE, 3)
ON CONFLICT (product_kind) DO UPDATE SET
  group_code = EXCLUDED.group_code,
  display_name = EXCLUDED.display_name,
  base_volume_units_per_piece = EXCLUDED.base_volume_units_per_piece,
  has_size = EXCLUDED.has_size,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
