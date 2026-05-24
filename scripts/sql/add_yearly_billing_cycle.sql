-- Add YEARLY to billing_cycle_enum (guest form: monthly / yearly only)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'billing_cycle_enum'
      AND e.enumlabel = 'YEARLY'
  ) THEN
    ALTER TYPE billing_cycle_enum ADD VALUE 'YEARLY';
  END IF;
END
$do$;
