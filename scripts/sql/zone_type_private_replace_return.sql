-- Replace zone_type_enum value RETURN → PRIVATE.
-- Run: node scripts/run-migration.mjs scripts/sql/zone_type_private_replace_return.sql

BEGIN;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'zone_type_enum'
      AND e.enumlabel = 'RETURN'
  ) THEN
    RAISE NOTICE 'zone_type_enum: RETURN already removed, skipping enum swap';
    RETURN;
  END IF;

  CREATE TYPE zone_type_enum_new AS ENUM ('SHARED', 'FAST_MOVING', 'PREMIUM', 'PRIVATE');

  ALTER TABLE warehouse_zones ALTER COLUMN zone_type DROP DEFAULT;
  ALTER TABLE warehouse_zones
    ALTER COLUMN zone_type TYPE zone_type_enum_new
    USING (
      CASE zone_type::text
        WHEN 'RETURN' THEN 'PRIVATE'::zone_type_enum_new
        ELSE zone_type::text::zone_type_enum_new
      END
    );
  ALTER TABLE warehouse_zones ALTER COLUMN zone_type SET DEFAULT 'SHARED';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rental_requests' AND column_name = 'suggested_zone_type'
  ) THEN
    ALTER TABLE rental_requests
      ALTER COLUMN suggested_zone_type TYPE zone_type_enum_new
      USING (
        CASE
          WHEN suggested_zone_type::text = 'RETURN' THEN NULL
          ELSE suggested_zone_type::text::zone_type_enum_new
        END
      );
  END IF;

  DROP TYPE zone_type_enum;
  ALTER TYPE zone_type_enum_new RENAME TO zone_type_enum;
END $do$;

COMMIT;
