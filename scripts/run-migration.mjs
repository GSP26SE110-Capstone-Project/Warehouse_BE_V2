import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('Usage: node scripts/run-migration.mjs <path-to.sql>');
  process.exit(1);
}

const sqlPath = fileArg.startsWith('/') || /^[A-Za-z]:/.test(fileArg)
  ? fileArg
  : join(root, fileArg);

/** Same connection rules as src/config/db.js */
function getPgConfig() {
  const password = process.env.POSTGRES_PASSWORD ?? process.env.PGPASSWORD;

  if (process.env.DATABASE_URL?.trim()) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      if (!url.password && password) {
        url.password = password;
      }
      if (url.password !== undefined && url.password !== null) {
        url.password = decodeURIComponent(url.password);
      }
      return { connectionString: url.toString() };
    } catch {
      return { connectionString: process.env.DATABASE_URL };
    }
  }

  return {
    user: process.env.POSTGRES_USER || process.env.PGUSER || 'warehouse_admin',
    host: process.env.POSTGRES_HOST || process.env.PGHOST || 'localhost',
    database: process.env.POSTGRES_DB || process.env.PGDATABASE || 'smart_warehouse',
    password: String(password ?? ''),
    port: Number(process.env.POSTGRES_PORT || process.env.PGPORT || 5432),
  };
}

const config = getPgConfig();
const sql = readFileSync(sqlPath, 'utf8');
const client = new pg.Client(config);

try {
  await client.connect();
  const target =
    config.connectionString?.replace(/:([^:@/]+)@/, ':***@') ||
    `${config.user}@${config.host}:${config.port}/${config.database}`;
  console.log(`Connected: ${target}`);
  console.log(`Running migration: ${sqlPath}`);
  await client.query(sql);
  console.log('Migration completed successfully.');
} catch (err) {
  console.error('Migration failed:', err.message);
  if (config.connectionString?.includes('@postgres:')) {
    console.error(
      'Hint: DATABASE_URL points to Docker host "postgres". For local npm run, use localhost in .env or unset DATABASE_URL and set POSTGRES_*.',
    );
  }
  if (!config.connectionString && config.password === '') {
    console.error('Hint: Set POSTGRES_PASSWORD in .env (same as docker-compose POSTGRES_PASSWORD).');
  }
  process.exit(1);
} finally {
  await client.end();
}
