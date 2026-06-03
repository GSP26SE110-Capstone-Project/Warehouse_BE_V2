/**
 * Seed toàn bộ dữ liệu demo (idempotent — chạy lại an toàn).
 *
 * Usage: npm run seed:all
 *
 * Thứ tự: locations → accounts → warehouse → product master → collections
 *         → sku/lpn/inbound → extended (rental, billing, inventory, outbound, …)
 */
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const SEED_STEPS = [
  { file: 'seed-locations.mjs', label: 'Cities & districts' },
  { file: 'seed-accounts.mjs', label: 'Tenants, warehouses, core users' },
  { file: 'seed-warehouse.mjs', label: 'Zones, racks, levels, bins' },
  { file: 'seed-product-master.mjs', label: 'Categories & seasons' },
  { file: 'seed-collections.mjs', label: 'Collections per tenant' },
  { file: 'seed-sku-lpn.mjs', label: 'Contract, inbound, SKUs, LPNs' },
  { file: 'seed-extended.mjs', label: 'Remaining tables (rental, billing, inventory, …)' },
];

console.log(`Running ${SEED_STEPS.length} seed steps...\n`);

for (let i = 0; i < SEED_STEPS.length; i++) {
  const step = SEED_STEPS[i];
  const rel = join('scripts', step.file);
  console.log(`--- [${i + 1}/${SEED_STEPS.length}] ${step.label} (${step.file}) ---`);

  const result = spawnSync(process.execPath, [join(__dirname, step.file)], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`\nSeed stopped at: ${step.file}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\nAll ${SEED_STEPS.length} seed steps completed successfully.`);
