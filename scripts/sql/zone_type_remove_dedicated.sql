-- Remove DEDICATED from zone_type_enum.
-- Dedicated storage is represented by warehouse_zones.is_dedicated, not zone_type.
--
-- Run: npm run db:migrate -- scripts/sql/zone_type_remove_dedicated.sql
-- Or:  node scripts/run-migration.mjs scripts/sql/zone_type_remove_dedicated.sql

BEGIN;

-- 1) Migrate rows still using zone_type = DEDICATED
UPDATE warehouse_zones
SET
  zone_type = 'SHARED',
  is_dedicated = TRUE,
  updated_at = NOW()
WHERE zone_type::text = 'DEDICATED';

-- 2) Replace enum only when DEDICATED label still exists
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'zone_type_enum'
      AND e.enumlabel = 'DEDICATED'
  ) THEN
    RAISE NOTICE 'zone_type_enum: DEDICATED already removed, skipping enum swap';
    RETURN;
  END IF;

  CREATE TYPE zone_type_enum_new AS ENUM (
    'SHARED',
    'FAST_MOVING',
    'BULK',
    'PREMIUM',
    'QC',
    'RETURN'
  );

  ALTER TABLE warehouse_zones
    ALTER COLUMN zone_type DROP DEFAULT;

  ALTER TABLE warehouse_zones
    ALTER COLUMN zone_type TYPE zone_type_enum_new
    USING (zone_type::text::zone_type_enum_new);

  ALTER TABLE warehouse_zones
    ALTER COLUMN zone_type SET DEFAULT 'SHARED';

  DROP TYPE zone_type_enum;

  ALTER TYPE zone_type_enum_new RENAME TO zone_type_enum;
END $do$;

COMMIT;
