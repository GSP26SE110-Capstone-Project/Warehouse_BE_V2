/**
 * Seed bộ tài khoản mẫu (System Admin / Warehouse Admin / Tenant Admin)
 * theo docs/request.md.
 *
 * Usage: npm run seed:accounts
 *
 * Idempotent:
 *   - Skip user/warehouse/tenant đã tồn tại (match theo email / warehouse_id / tenant_id).
 *   - Có thể chạy lại nhiều lần.
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from '../src/config/db.js';

const WAREHOUSE_ID = '2084bdca-8320-439c-8e37-e0d37fa3d7c9';
const TENANT_ID = '1fb376e8-b68a-4ffc-bdb5-de570ff2917d';

const WAREHOUSE = {
  warehouseId: WAREHOUSE_ID,
  warehouseCode: 'WH-HCM-01',
  warehouseName: 'Kho HCM Trung tâm',
  address: 'Quận 7, TP.HCM',
};

const TENANT = {
  tenantId: TENANT_ID,
  companyName: 'Brand A Fashion JSC',
  companyCode: 'BRAND-A',
  taxCode: '0312000001',
  contactName: 'Tenant Admin A',
  contactEmail: 'tenant1admin@brand.local',
  contactPhone: '0901111111',
  address: 'Quận 1, TP.HCM',
};

const ACCOUNTS = [
  {
    label: 'SYSTEM_ADMIN',
    role: 'SYSTEM_ADMIN',
    fullName: 'System Administrator',
    email: 'admin@warehouse.local',
    password: 'admin12345',
    tenantId: null,
    warehouseId: null,
  },
  {
    label: 'WH_ADMIN',
    role: 'WH_ADMIN',
    fullName: 'Kho trưởng HCM',
    email: 'whadmin@warehouse.local',
    password: 'WhAdmin@12345',
    tenantId: null,
    warehouseId: WAREHOUSE_ID,
  },
  {
    label: 'TENANT_ADMIN',
    role: 'TENANT_ADMIN',
    fullName: 'Tenant Admin A',
    email: 'tenant1admin@brand.local',
    password: 'Tenant1@12345',
    tenantId: TENANT_ID,
    warehouseId: null,
  },
];

async function ensureWarehouse() {
  const existing = await pool.query(
    'SELECT warehouse_id, warehouse_code, warehouse_name FROM warehouses WHERE warehouse_id = $1',
    [WAREHOUSE.warehouseId]
  );
  if (existing.rows.length > 0) {
    console.log('Warehouse exists:', existing.rows[0].warehouse_code);
    return existing.rows[0];
  }

  const result = await pool.query(
    `INSERT INTO warehouses
       (warehouse_id, warehouse_code, warehouse_name, address, status)
     VALUES ($1, $2, $3, $4, 'ACTIVE')
     ON CONFLICT (warehouse_code) DO UPDATE
       SET warehouse_name = EXCLUDED.warehouse_name
     RETURNING warehouse_id, warehouse_code, warehouse_name`,
    [
      WAREHOUSE.warehouseId,
      WAREHOUSE.warehouseCode,
      WAREHOUSE.warehouseName,
      WAREHOUSE.address,
    ]
  );
  console.log('Created warehouse:', result.rows[0]);
  return result.rows[0];
}

async function ensureTenant() {
  const existing = await pool.query(
    'SELECT tenant_id, company_name, company_code FROM tenant_companies WHERE tenant_id = $1',
    [TENANT.tenantId]
  );
  if (existing.rows.length > 0) {
    console.log('Tenant exists:', existing.rows[0].company_name);
    return existing.rows[0];
  }

  const result = await pool.query(
    `INSERT INTO tenant_companies
       (tenant_id, company_name, company_code, tax_code,
        contact_name, contact_email, contact_phone, address, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')
     ON CONFLICT (company_code) DO UPDATE
       SET company_name = EXCLUDED.company_name
     RETURNING tenant_id, company_name, company_code`,
    [
      TENANT.tenantId,
      TENANT.companyName,
      TENANT.companyCode,
      TENANT.taxCode,
      TENANT.contactName,
      TENANT.contactEmail,
      TENANT.contactPhone,
      TENANT.address,
    ]
  );
  console.log('Created tenant:', result.rows[0]);
  return result.rows[0];
}

async function ensureUser(account) {
  const email = account.email.toLowerCase();
  const existing = await pool.query(
    'SELECT user_id, email, role FROM users WHERE email = $1',
    [email]
  );
  if (existing.rows.length > 0) {
    console.log(`User exists (${account.label}):`, existing.rows[0].email);
    return existing.rows[0];
  }

  const passwordHash = await bcrypt.hash(account.password, 10);
  const result = await pool.query(
    `INSERT INTO users
       (tenant_id, warehouse_id, full_name, email, password_hash, role, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
     RETURNING user_id, email, role, tenant_id, warehouse_id`,
    [
      account.tenantId,
      account.warehouseId,
      account.fullName,
      email,
      passwordHash,
      account.role,
    ]
  );
  console.log(`Created user (${account.label}):`, result.rows[0]);
  return result.rows[0];
}

try {
  await ensureWarehouse();
  await ensureTenant();

  for (const account of ACCOUNTS) {
    await ensureUser(account);
  }

  console.log('\nLogin credentials (xem docs/request.md dòng 9–20):');
  for (const account of ACCOUNTS) {
    console.log(`  - ${account.label}: ${account.email} / ${account.password}`);
  }
} catch (err) {
  console.error('Seed accounts failed:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
