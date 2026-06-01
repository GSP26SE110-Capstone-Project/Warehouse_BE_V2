-- Link tenant SKUs to product_kind_catalog (T_SHIRT, JEANS, …)
-- Chạy: node scripts/run-migration.mjs scripts/sql/skus_add_product_kind.sql

ALTER TABLE skus
  ADD COLUMN IF NOT EXISTS product_kind VARCHAR(50) REFERENCES product_kind_catalog (product_kind);

CREATE INDEX IF NOT EXISTS idx_skus_product_kind ON skus (product_kind);
