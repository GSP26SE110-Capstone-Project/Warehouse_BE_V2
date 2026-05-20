/**
 * Create initial SYSTEM_ADMIN (run once).
 * Usage: node scripts/seed-system-admin.mjs
 *
 * Env: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME (optional)
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from '../src/config/db.js';

const email = (process.env.SEED_ADMIN_EMAIL || 'admin@warehouse.local').toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD || 'admin12345';
const fullName = process.env.SEED_ADMIN_NAME || 'System Administrator';

const existing = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
if (existing.rows.length > 0) {
  console.log(`SYSTEM_ADMIN already exists: ${email}`);
  await pool.end();
  process.exit(0);
}

const passwordHash = await bcrypt.hash(password, 10);
const result = await pool.query(
  `INSERT INTO users (full_name, email, password_hash, role, status)
   VALUES ($1, $2, $3, 'SYSTEM_ADMIN', 'ACTIVE')
   RETURNING user_id, email, role`,
  [fullName, email, passwordHash]
);

console.log('Created SYSTEM_ADMIN:', result.rows[0]);
console.log('Login with POST /api/auth/login');
await pool.end();
