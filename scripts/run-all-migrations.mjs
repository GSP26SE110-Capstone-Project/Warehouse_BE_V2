import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

/**
 * Full migration chain for fresh clone / after git pull.
 * Base schema first, then incremental patches (order matters).
 * Excludes db4_drop_legacy.sql (use npm run db:reset instead).
 */
const MIGRATION_FILES = [
  'scripts/sql/db4_schema.sql',
  'scripts/sql/zone_type_remove_dedicated.sql',
  'scripts/sql/simplify_zone_rack_enums.sql',
  'scripts/sql/bin_max_volume_16.sql',
  'scripts/sql/rental_requests_add_estimation_fields.sql',
  'scripts/sql/rental_requests_add_tenant_id.sql',
  'scripts/sql/add_location_fields.sql',
  'scripts/sql/locations.sql',
  'scripts/sql/rental_requests_add_requested_area_m2.sql',
  'scripts/sql/contracts_add_rental_request_id.sql',
  'scripts/sql/contracts_add_signatures.sql',
  'scripts/sql/contract_type_needs_consultation.sql',
  'scripts/sql/lpns_add_weight_kg.sql',
  'scripts/sql/add_yearly_billing_cycle.sql',
  'scripts/sql/add_wh_transporter.sql',
  'scripts/sql/inbound_delivery_shipment_vehicle.sql',
  'scripts/sql/branches.sql',
  'scripts/sql/bin_lpn_count_equals_volume.sql',
  'scripts/sql/bins_resync_lpn_volume.sql',
  'scripts/sql/zone_type_private_replace_return.sql',
  'scripts/sql/garment_category_product_kind_catalog.sql',
  'scripts/sql/size_factor_rental_product_lines.sql',
  'scripts/sql/skus_add_product_kind.sql',
];

console.log(`Running ${MIGRATION_FILES.length} migrations...\n`);

for (let i = 0; i < MIGRATION_FILES.length; i++) {
  const rel = MIGRATION_FILES[i];
  console.log(`--- [${i + 1}/${MIGRATION_FILES.length}] ${rel} ---`);

  const result = spawnSync(process.execPath, [join(__dirname, 'run-migration.mjs'), rel], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`\nMigration stopped at: ${rel}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\nAll ${MIGRATION_FILES.length} migrations completed successfully.`);
