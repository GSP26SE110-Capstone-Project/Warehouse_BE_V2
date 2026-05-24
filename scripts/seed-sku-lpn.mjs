/**
 * Seed 3 SKU + 3 LPN mẫu (và batch/inbound/contract nếu chưa có).
 *
 * Usage: npm run seed:sku-lpn
 *
 * Prerequisites (khuyến nghị):
 *   npm run seed:accounts
 *   npm run seed:product-master
 *   npm run seed:collections
 *
 * Env:
 *   SEED_TENANT_ID   — optional, default tenant từ seed:accounts
 *   SEED_WAREHOUSE_ID — optional, default WH-HCM-01
 *
 * Idempotent: skip theo (tenant_id, sku_code) và lpn_code.
 */
import 'dotenv/config';
import pool from '../src/config/db.js';

const DEFAULT_TENANT_ID = '1fb376e8-b68a-4ffc-bdb5-de570ff2917d';
const DEFAULT_WAREHOUSE_ID = '2084bdca-8320-439c-8e37-e0d37fa3d7c9';

const DEMO_CONTRACT_CODE = 'CTR-SEED-DEMO';
const DEMO_INBOUND_CODE = 'INB-SEED-DEMO';
const DEMO_BATCH_CODE = 'BATCH-SEED-DEMO';

const SKUS = [
  {
    skuCode: 'SEED-SKU-001',
    productName: 'Áo thun basic đen',
    categoryName: 'Áo',
    collectionName: 'Dòng cơ bản',
    seasonName: 'Hè 2026',
    color: 'Đen',
    size: 'M',
    material: 'Cotton',
    movementCategory: 'FAST',
  },
  {
    skuCode: 'SEED-SKU-002',
    productName: 'Quần jean slim xanh',
    categoryName: 'Quần',
    collectionName: 'Thời trang hàng ngày',
    seasonName: 'Hè 2026',
    color: 'Xanh navy',
    size: '32',
    material: 'Denim',
    movementCategory: 'NORMAL',
  },
  {
    skuCode: 'SEED-SKU-003',
    productName: 'Áo sơ mi công sở trắng',
    categoryName: 'Áo',
    collectionName: 'Công sở',
    seasonName: 'Thu 2026',
    color: 'Trắng',
    size: 'L',
    material: 'Polyester',
    movementCategory: 'NORMAL',
  },
];

const LPNS = [
  {
    lpnCode: 'SEED-LPN-001',
    boxType: 'MEDIUM',
    volumeUnits: 2,
    maxCapacity: 50,
    weightKg: 12.5,
    status: 'RECEIVING',
    details: [{ skuCode: 'SEED-SKU-001', quantity: 24 }],
  },
  {
    lpnCode: 'SEED-LPN-002',
    boxType: 'LARGE',
    volumeUnits: 4,
    maxCapacity: 80,
    weightKg: 28,
    status: 'RECEIVING',
    details: [{ skuCode: 'SEED-SKU-002', quantity: 15 }],
  },
  {
    lpnCode: 'SEED-LPN-003',
    boxType: 'SMALL',
    volumeUnits: 1,
    maxCapacity: 30,
    weightKg: 5.2,
    status: 'RECEIVING',
    details: [
      { skuCode: 'SEED-SKU-001', quantity: 10 },
      { skuCode: 'SEED-SKU-003', quantity: 8 },
    ],
  },
];

async function resolveTenantId() {
  const id = (process.env.SEED_TENANT_ID || DEFAULT_TENANT_ID).trim();
  const check = await pool.query(
    'SELECT tenant_id, company_name FROM tenant_companies WHERE tenant_id = $1',
    [id]
  );
  if (check.rows.length === 0) {
    throw new Error(`Tenant not found: ${id}. Run npm run seed:accounts first.`);
  }
  return check.rows[0];
}

async function resolveWarehouseId() {
  const id = (process.env.SEED_WAREHOUSE_ID || DEFAULT_WAREHOUSE_ID).trim();
  const check = await pool.query(
    'SELECT warehouse_id, warehouse_code FROM warehouses WHERE warehouse_id = $1',
    [id]
  );
  if (check.rows.length === 0) {
    throw new Error(`Warehouse not found: ${id}. Run npm run seed:accounts first.`);
  }
  return check.rows[0];
}

async function lookupByName(table, idColumn, nameColumn, name) {
  const result = await pool.query(
    `SELECT ${idColumn} AS id FROM ${table} WHERE LOWER(${nameColumn}) = LOWER($1) LIMIT 1`,
    [name]
  );
  return result.rows[0]?.id ?? null;
}

async function lookupCollection(tenantId, collectionName) {
  const result = await pool.query(
    `SELECT collection_id AS id FROM collections
     WHERE tenant_id = $1 AND LOWER(collection_name) = LOWER($2) LIMIT 1`,
    [tenantId, collectionName]
  );
  return result.rows[0]?.id ?? null;
}

async function ensureDemoContract(tenantId, warehouseId) {
  const existing = await pool.query(
    `SELECT contract_id, status FROM contracts
     WHERE tenant_id = $1 AND contract_code = $2`,
    [tenantId, DEMO_CONTRACT_CODE]
  );
  if (existing.rows.length > 0) {
    if (existing.rows[0].status !== 'ACTIVE') {
      await pool.query(
        `UPDATE contracts SET status = 'ACTIVE', updated_at = NOW() WHERE contract_id = $1`,
        [existing.rows[0].contract_id]
      );
    }
    return existing.rows[0].contract_id;
  }

  const result = await pool.query(
    `INSERT INTO contracts (
       tenant_id, warehouse_id, contract_code, contract_name,
       contract_type, pricing_model, billing_cycle,
       start_date, end_date, status
     ) VALUES (
       $1, $2, $3, 'Hợp đồng seed demo',
       'SHARED_STORAGE', 'USAGE_BASED', 'MONTHLY',
       CURRENT_DATE, CURRENT_DATE + INTERVAL '365 days', 'ACTIVE'
     )
     RETURNING contract_id`,
    [tenantId, warehouseId, DEMO_CONTRACT_CODE]
  );
  return result.rows[0].contract_id;
}

async function ensureDemoInbound(tenantId, warehouseId, contractId) {
  const existing = await pool.query(
    `SELECT inbound_request_id, status FROM inbound_requests WHERE inbound_code = $1`,
    [DEMO_INBOUND_CODE]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].inbound_request_id;
  }

  const result = await pool.query(
    `INSERT INTO inbound_requests (
       tenant_id, contract_id, warehouse_id, inbound_code,
       expected_arrival_date, status
     ) VALUES (
       $1, $2, $3, $4,
       NOW() + INTERVAL '3 days', 'RECEIVING'
     )
     RETURNING inbound_request_id`,
    [tenantId, contractId, warehouseId, DEMO_INBOUND_CODE]
  );
  return result.rows[0].inbound_request_id;
}

async function ensureDemoBatch(inboundRequestId) {
  const existing = await pool.query(
    `SELECT batch_id FROM batches WHERE batch_code = $1`,
    [DEMO_BATCH_CODE]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].batch_id;
  }

  const result = await pool.query(
    `INSERT INTO batches (inbound_request_id, batch_code, warehouse_received_at)
     VALUES ($1, $2, NOW())
     RETURNING batch_id`,
    [inboundRequestId, DEMO_BATCH_CODE]
  );
  return result.rows[0].batch_id;
}

async function seedSku(tenantId, spec) {
  const existing = await pool.query(
    `SELECT * FROM skus WHERE tenant_id = $1 AND sku_code = $2`,
    [tenantId, spec.skuCode]
  );
  if (existing.rows.length > 0) {
    return { row: existing.rows[0], inserted: false };
  }

  const categoryId = spec.categoryName
    ? await lookupByName('categories', 'category_id', 'category_name', spec.categoryName)
    : null;
  const seasonId = spec.seasonName
    ? await lookupByName('seasons', 'season_id', 'season_name', spec.seasonName)
    : null;
  const collectionId = spec.collectionName
    ? await lookupCollection(tenantId, spec.collectionName)
    : null;

  const result = await pool.query(
    `INSERT INTO skus (
       tenant_id, sku_code, product_name,
       category_id, collection_id, season_id,
       color, size, material, movement_category, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE')
     RETURNING *`,
    [
      tenantId,
      spec.skuCode,
      spec.productName,
      categoryId,
      collectionId,
      seasonId,
      spec.color ?? null,
      spec.size ?? null,
      spec.material ?? null,
      spec.movementCategory ?? 'NORMAL',
    ]
  );
  return { row: result.rows[0], inserted: true };
}

async function seedLpn(tenantId, batchId, spec) {
  const existing = await pool.query(`SELECT * FROM lpns WHERE lpn_code = $1`, [spec.lpnCode]);
  if (existing.rows.length > 0) {
    return { row: existing.rows[0], inserted: false };
  }

  const result = await pool.query(
    `INSERT INTO lpns (
       tenant_id, batch_id, lpn_code, box_type, volume_units,
       max_capacity, weight_kg, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      tenantId,
      batchId,
      spec.lpnCode,
      spec.boxType,
      spec.volumeUnits,
      spec.maxCapacity ?? null,
      spec.weightKg ?? null,
      spec.status ?? 'RECEIVING',
    ]
  );
  return { row: result.rows[0], inserted: true };
}

async function seedLpnDetail(lpnId, skuId, quantity) {
  const existing = await pool.query(
    `SELECT * FROM lpn_details WHERE lpn_id = $1 AND sku_id = $2`,
    [lpnId, skuId]
  );
  if (existing.rows.length > 0) {
    return { row: existing.rows[0], inserted: false };
  }

  const result = await pool.query(
    `INSERT INTO lpn_details (lpn_id, sku_id, quantity) VALUES ($1, $2, $3) RETURNING *`,
    [lpnId, skuId, quantity]
  );
  return { row: result.rows[0], inserted: true };
}

async function syncLpnTotals(lpnId) {
  const sumResult = await pool.query(
    `SELECT COALESCE(SUM(quantity), 0)::int AS total FROM lpn_details WHERE lpn_id = $1`,
    [lpnId]
  );
  const total = sumResult.rows[0].total;

  const lpnResult = await pool.query(
    `SELECT max_capacity FROM lpns WHERE lpn_id = $1`,
    [lpnId]
  );
  const maxCapacity = lpnResult.rows[0]?.max_capacity;
  let fillPercentage = null;
  if (maxCapacity != null && maxCapacity > 0) {
    fillPercentage = Math.min(100, Math.round((total / maxCapacity) * 10000) / 100);
  }

  await pool.query(
    `UPDATE lpns
     SET actual_quantity = $2,
         fill_percentage = $3,
         updated_at = NOW()
     WHERE lpn_id = $1`,
    [lpnId, total, fillPercentage]
  );
}

async function seedInboundItem(inboundRequestId, skuId, expectedQuantity) {
  const existing = await pool.query(
    `SELECT * FROM inbound_request_items
     WHERE inbound_request_id = $1 AND sku_id = $2`,
    [inboundRequestId, skuId]
  );
  if (existing.rows.length > 0) {
    return { inserted: false };
  }

  await pool.query(
    `INSERT INTO inbound_request_items (inbound_request_id, sku_id, expected_quantity)
     VALUES ($1, $2, $3)`,
    [inboundRequestId, skuId, expectedQuantity]
  );
  return { inserted: true };
}

// --- run ---
const tenant = await resolveTenantId();
const warehouse = await resolveWarehouseId();
console.log('Tenant:', tenant.company_name, tenant.tenant_id);
console.log('Warehouse:', warehouse.warehouse_code, warehouse.warehouse_id);

const contractId = await ensureDemoContract(tenant.tenant_id, warehouse.warehouse_id);
console.log('Contract:', DEMO_CONTRACT_CODE, contractId);

const inboundRequestId = await ensureDemoInbound(
  tenant.tenant_id,
  warehouse.warehouse_id,
  contractId
);
console.log('Inbound:', DEMO_INBOUND_CODE, inboundRequestId);

const batchId = await ensureDemoBatch(inboundRequestId);
console.log('Batch:', DEMO_BATCH_CODE, batchId);

const skuByCode = new Map();
let skuInserted = 0;
let skuSkipped = 0;

for (const spec of SKUS) {
  const { row, inserted } = await seedSku(tenant.tenant_id, spec);
  skuByCode.set(spec.skuCode, row.sku_id);
  if (inserted) skuInserted += 1;
  else skuSkipped += 1;
  console.log(inserted ? '[SKU +]' : '[SKU =]', row.sku_id, row.sku_code, row.product_name);

  await seedInboundItem(inboundRequestId, row.sku_id, 50);
}

let lpnInserted = 0;
let lpnSkipped = 0;
let detailInserted = 0;

for (const spec of LPNS) {
  const { row: lpn, inserted } = await seedLpn(tenant.tenant_id, batchId, spec);
  if (inserted) lpnInserted += 1;
  else lpnSkipped += 1;
  console.log(inserted ? '[LPN +]' : '[LPN =]', lpn.lpn_id, lpn.lpn_code, lpn.box_type);

  for (const line of spec.details) {
    const skuId = skuByCode.get(line.skuCode);
    if (!skuId) {
      throw new Error(`SKU not found for detail: ${line.skuCode}`);
    }
    const detail = await seedLpnDetail(lpn.lpn_id, skuId, line.quantity);
    if (detail.inserted) detailInserted += 1;
    console.log(
      detail.inserted ? '  [detail +]' : '  [detail =]',
      line.skuCode,
      'qty',
      line.quantity
    );
  }

  await syncLpnTotals(lpn.lpn_id);
}

console.log('\nSummary');
console.log('  SKUs: inserted', skuInserted, 'skipped', skuSkipped);
console.log('  LPNs: inserted', lpnInserted, 'skipped', lpnSkipped);
console.log('  LPN details inserted:', detailInserted);
console.log('\nTest:');
console.log('  GET /api/skus?tenantId=' + tenant.tenant_id);
console.log('  GET /api/lpns?tenantId=' + tenant.tenant_id + '&batchId=' + batchId);

await pool.end();
