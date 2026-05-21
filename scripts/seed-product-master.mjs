/**
 * Seed global product master data: categories (Áo, Quần) and seasons.
 * Usage: npm run seed:product-master
 *
 * Idempotent: skips rows that already exist (match by category_name / season_name, case-insensitive).
 */
import 'dotenv/config';
import pool from '../src/config/db.js';

const CATEGORIES = ['Áo', 'Quần'];

const SEASONS = ['Xuân 2026', 'Hè 2026', 'Thu 2026', 'Đông 2026'];

async function seedByName(table, nameColumn, names) {
  const inserted = [];
  const skipped = [];

  for (const name of names) {
    const existing = await pool.query(
      `SELECT * FROM ${table} WHERE LOWER(${nameColumn}) = LOWER($1)`,
      [name]
    );
    if (existing.rows.length > 0) {
      skipped.push(existing.rows[0]);
      continue;
    }

    const result = await pool.query(
      `INSERT INTO ${table} (${nameColumn}) VALUES ($1) RETURNING *`,
      [name]
    );
    inserted.push(result.rows[0]);
  }

  return { inserted, skipped };
}

const categories = await seedByName('categories', 'category_name', CATEGORIES);
const seasons = await seedByName('seasons', 'season_name', SEASONS);

console.log('Categories — inserted:', categories.inserted.length, 'skipped:', categories.skipped.length);
for (const row of [...categories.inserted, ...categories.skipped]) {
  console.log('  -', row.category_id, row.category_name);
}

console.log('Seasons — inserted:', seasons.inserted.length, 'skipped:', seasons.skipped.length);
for (const row of [...seasons.inserted, ...seasons.skipped]) {
  console.log('  -', row.season_id, row.season_name);
}

await pool.end();
