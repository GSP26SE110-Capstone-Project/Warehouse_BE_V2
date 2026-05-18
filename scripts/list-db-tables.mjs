import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: String(process.env.POSTGRES_PASSWORD ?? ''),
  port: Number(process.env.POSTGRES_PORT || 5432),
});

const DB4_TABLES = new Set([
  'tenant_companies', 'warehouses', 'users', 'warehouse_zones', 'racks', 'rack_levels', 'bins',
  'rental_requests', 'contracts', 'contract_items', 'storage_reservations',
  'categories', 'collections', 'seasons', 'skus',
  'inbound_requests', 'inbound_request_items', 'batches', 'lpns', 'lpn_details',
  'inventories', 'inventory_movements',
  'outbound_requests', 'outbound_request_items', 'picking_tasks', 'picking_task_items', 'shipments',
  'pricing_policies', 'storage_usage_snapshots', 'invoices', 'invoice_items', 'payments',
  'ai_slot_recommendations', 'occupancy_snapshots', 'sku_movement_analytics',
]);

await client.connect();
const { rows } = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`);
await client.end();

const all = rows.map((r) => r.table_name);
const legacy = all.filter((t) => !DB4_TABLES.has(t));
const db4 = all.filter((t) => DB4_TABLES.has(t));

console.log('=== db4 tables (' + db4.length + ') ===');
console.log(db4.join('\n'));
console.log('\n=== legacy / extra tables (' + legacy.length + ') ===');
console.log(legacy.length ? legacy.join('\n') : '(none)');
