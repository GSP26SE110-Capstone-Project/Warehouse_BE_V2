/**
 * Seed collections per tenant (bộ sưu tập / dòng hàng).
 * Usage: npm run seed:collections
 *
 * Env: SEED_TENANT_ID (optional) — UUID tenant; nếu bỏ trống dùng tenant ACTIVE đầu tiên.
 *
 * Idempotent: skips collection_name đã tồn tại cho cùng tenant (case-insensitive).
 */
import 'dotenv/config';
import pool from '../src/config/db.js';

const COLLECTIONS = [
  'Dòng cơ bản',
  'Thời trang hàng ngày',
  'Công sở',
  'Cao cấp',
];

async function resolveTenantId() {
  if (process.env.SEED_TENANT_ID) {
    const id = process.env.SEED_TENANT_ID.trim();
    const check = await pool.query(
      'SELECT tenant_id, company_name FROM tenant_companies WHERE tenant_id = $1',
      [id]
    );
    if (check.rows.length === 0) {
      throw new Error(`SEED_TENANT_ID not found: ${id}`);
    }
    return check.rows[0];
  }

  const result = await pool.query(
    `SELECT tenant_id, company_name FROM tenant_companies
     WHERE status = 'ACTIVE' OR status IS NULL
     ORDER BY created_at ASC
     LIMIT 1`
  );
  if (result.rows.length === 0) {
    throw new Error('No tenant found. Create a tenant first or set SEED_TENANT_ID.');
  }
  return result.rows[0];
}

const tenant = await resolveTenantId();
console.log('Tenant:', tenant.company_name, tenant.tenant_id);

const inserted = [];
const skipped = [];

for (const name of COLLECTIONS) {
  const existing = await pool.query(
    `SELECT * FROM collections
     WHERE tenant_id = $1 AND LOWER(collection_name) = LOWER($2)`,
    [tenant.tenant_id, name]
  );
  if (existing.rows.length > 0) {
    skipped.push(existing.rows[0]);
    continue;
  }

  const result = await pool.query(
    `INSERT INTO collections (tenant_id, collection_name)
     VALUES ($1, $2)
     RETURNING *`,
    [tenant.tenant_id, name]
  );
  inserted.push(result.rows[0]);
}

console.log('Collections — inserted:', inserted.length, 'skipped:', skipped.length);
for (const row of [...inserted, ...skipped]) {
  console.log('  -', row.collection_id, row.collection_name);
}

await pool.end();
