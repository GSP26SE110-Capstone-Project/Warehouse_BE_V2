-- Bỏ FAST_MOVING khỏi zone_type_enum.
-- Chạy: node scripts/run-migration.mjs scripts/sql/zone_type_remove_fast_moving.sql

BEGIN;

UPDATE warehouse_zones
SET zone_type = 'SHARED', updated_at = NOW()
WHERE zone_type::text = 'FAST_MOVING';

UPDATE rental_requests
SET suggested_zone_type = 'SHARED', updated_at = NOW()
WHERE suggested_zone_type::text = 'FAST_MOVING';

DO $do$
BEGIN
  CREATE TYPE zone_type_enum_new AS ENUM ('SHARED', 'PREMIUM', 'PRIVATE');

  ALTER TABLE warehouse_zones ALTER COLUMN zone_type DROP DEFAULT;
  ALTER TABLE warehouse_zones
    ALTER COLUMN zone_type TYPE zone_type_enum_new
    USING (zone_type::text::zone_type_enum_new);
  ALTER TABLE warehouse_zones ALTER COLUMN zone_type SET DEFAULT 'SHARED';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rental_requests' AND column_name = 'suggested_zone_type'
  ) THEN
    ALTER TABLE rental_requests
      ALTER COLUMN suggested_zone_type TYPE zone_type_enum_new
      USING (
        CASE
          WHEN suggested_zone_type::text = 'FAST_MOVING' THEN 'SHARED'::zone_type_enum_new
          ELSE suggested_zone_type::text::zone_type_enum_new
        END
      );
  END IF;

  DROP TYPE zone_type_enum;
  ALTER TYPE zone_type_enum_new RENAME TO zone_type_enum;
END $do$;

COMMIT;
