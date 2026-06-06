/**
 * Seed toàn bộ dữ liệu mẫu production-like cho deploy (Render / fresh DB).
 *
 * Usage:
 *   npm run db:migrate:all
 *   npm run seed:all
 *
 * Idempotent — chạy lại an toàn (match theo email, mã nghiệp vụ, unique key).
 * Dữ liệu dùng mã thực tế (CTR-BRA-2026-001, BRA-TS-BLK-M, LPN-20260606-0001, …).
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from '../src/config/db.js';

// ─── Fixed IDs (ổn định giữa các lần chạy) ───────────────────────────────────
const WAREHOUSE_ID = '2084bdca-8320-439c-8e37-e0d37fa3d7c9';
const WAREHOUSE_ID_2 = '3a0e2b71-1c4f-4d2a-9b35-7c8b50d2b101';
const WAREHOUSE_ID_HN = '4b1d3e82-2d5f-4e3a-8c46-8d9c61e3c202';
const TENANT_ID = '1fb376e8-b68a-4ffc-bdb5-de570ff2917d';

// ─── Mã nghiệp vụ (không chứa "seed") ───────────────────────────────────────
const CONTRACT_CODE = 'CTR-BRA-2026-001';
const INBOUND_CODE = 'INB-BRA-202606-001';
const BATCH_CODE = 'BAT-BRA-202606-001';
const RENTAL_CODE = 'RR-BRA-2026-001';
const OUTBOUND_CODE = 'OUT-BRA-202606-001';
const INVOICE_CODE = 'INV-BRA-2026-06';
const SHIPMENT_CODE = 'SHP-BRA-202606-001';
const PAYMENT_TXN = 'TXN-BRA-20260606-001';
const APPENDIX_CODE = 'PL-BRA-2026-01';
const BRANCH_CODE = 'BR-HCM-01';

const LPN_PREFIX = 'LPN-20260606-';

// ─── Master data ─────────────────────────────────────────────────────────────
const LOCATIONS = [
  {
    cityCode: 'HCM',
    cityName: 'TP.HCM',
    displayOrder: 1,
    districts: [
      'Quận 1', 'Quận 2', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 6', 'Quận 7',
      'Quận 8', 'Quận 9', 'Quận 10', 'Quận 11', 'Quận 12', 'Bình Thạnh',
      'Bình Tân', 'Gò Vấp', 'Phú Nhuận', 'Tân Bình', 'Tân Phú', 'Thủ Đức',
      'Hóc Môn', 'Củ Chi', 'Nhà Bè', 'Cần Giờ', 'Bình Chánh',
    ],
  },
  {
    cityCode: 'HN',
    cityName: 'Hà Nội',
    displayOrder: 2,
    districts: [
      'Ba Đình', 'Hoàn Kiếm', 'Tây Hồ', 'Long Biên', 'Cầu Giấy', 'Đống Đa',
      'Hai Bà Trưng', 'Hoàng Mai', 'Thanh Xuân', 'Hà Đông', 'Nam Từ Liêm',
      'Bắc Từ Liêm', 'Sơn Tây', 'Ba Vì', 'Phúc Thọ', 'Đan Phượng', 'Hoài Đức',
      'Quốc Oai', 'Thạch Thất', 'Chương Mỹ', 'Thanh Oai', 'Thường Tín',
      'Phú Xuyên', 'Ứng Hòa', 'Mỹ Đức', 'Gia Lâm', 'Đông Anh', 'Sóc Sơn', 'Mê Linh',
    ],
  },
];

const WAREHOUSES = [
  {
    warehouseId: WAREHOUSE_ID,
    warehouseCode: 'WH-HCM-01',
    warehouseName: 'Kho HCM Trung tâm',
    address: 'Quận 7, TP.HCM',
    city: 'TP.HCM',
    district: 'Quận 7',
    totalAreaM2: 5000,
    usableAreaM2: 4200,
    zones: [
      { zoneCode: 'Z-A01', zoneName: 'Khu chia sẻ A01', zoneType: 'SHARED', areaM2: 800, isDedicated: false, racks: [{ rackCode: 'R-A01-01', rackType: 'STANDARD', maxLevels: 4 }, { rackCode: 'R-A01-02', rackType: 'STANDARD', maxLevels: 4 }] },
      { zoneCode: 'Z-B01', zoneName: 'Hàng xoay nhanh B01', zoneType: 'SHARED', areaM2: 600, isDedicated: false, racks: [{ rackCode: 'R-B01-01', rackType: 'STANDARD', maxLevels: 3 }, { rackCode: 'R-B01-02', rackType: 'STANDARD', maxLevels: 3 }] },
      { zoneCode: 'Z-C01', zoneName: 'Khu chia sẻ C01', zoneType: 'SHARED', areaM2: 900, isDedicated: false, racks: [{ rackCode: 'R-C01-01', rackType: 'STANDARD', maxLevels: 3 }, { rackCode: 'R-C01-02', rackType: 'STANDARD', maxLevels: 3 }] },
      { zoneCode: 'Z-P01', zoneName: 'Khu cao cấp P01', zoneType: 'PREMIUM', areaM2: 400, isDedicated: true, racks: [{ rackCode: 'R-P01-01', rackType: 'STANDARD', maxLevels: 3 }] },
      { zoneCode: 'Z-PRV', zoneName: 'Khu riêng PRV01', zoneType: 'PRIVATE', areaM2: 500, isDedicated: true, racks: [{ rackCode: 'R-PRV-01', rackType: 'STANDARD', maxLevels: 3 }] },
    ],
  },
  {
    warehouseId: WAREHOUSE_ID_2,
    warehouseCode: 'WH-HCM-02',
    warehouseName: 'Kho HCM Quận 9',
    address: 'TP. Thủ Đức, TP.HCM',
    city: 'TP.HCM',
    district: 'Quận 9',
    totalAreaM2: 3500,
    usableAreaM2: 3000,
    zones: [
      { zoneCode: 'Z-A01', zoneName: 'Khu chia sẻ A01', zoneType: 'SHARED', areaM2: 700, isDedicated: false, racks: [{ rackCode: 'R-A01-01', rackType: 'STANDARD', maxLevels: 3 }, { rackCode: 'R-A01-02', rackType: 'STANDARD', maxLevels: 3 }] },
      { zoneCode: 'Z-B01', zoneName: 'Hàng xoay nhanh B01', zoneType: 'SHARED', areaM2: 500, isDedicated: false, racks: [{ rackCode: 'R-B01-01', rackType: 'STANDARD', maxLevels: 3 }] },
    ],
  },
  {
    warehouseId: WAREHOUSE_ID_HN,
    warehouseCode: 'WH-HN-01',
    warehouseName: 'Kho Hà Nội Long Biên',
    address: 'Long Biên, Hà Nội',
    city: 'Hà Nội',
    district: 'Long Biên',
    totalAreaM2: 4000,
    usableAreaM2: 3400,
    zones: [
      { zoneCode: 'Z-A01', zoneName: 'Khu chia sẻ A01', zoneType: 'SHARED', areaM2: 750, isDedicated: false, racks: [{ rackCode: 'R-A01-01', rackType: 'STANDARD', maxLevels: 3 }, { rackCode: 'R-A01-02', rackType: 'STANDARD', maxLevels: 3 }] },
      { zoneCode: 'Z-C01', zoneName: 'Khu cao cấp C01', zoneType: 'PREMIUM', areaM2: 850, isDedicated: false, racks: [{ rackCode: 'R-C01-01', rackType: 'STANDARD', maxLevels: 3 }] },
    ],
  },
];

const BINS_PER_LEVEL = 4;
const BOX_TYPES = ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'];

const ACCOUNTS = [
  { label: 'SYSTEM_ADMIN', role: 'SYSTEM_ADMIN', fullName: 'System Administrator', email: 'admin@warehouse.local', password: 'admin12345', tenantId: null, warehouseId: null },
  { label: 'WH_ADMIN', role: 'WH_ADMIN', fullName: 'Nguyễn Văn Kho', email: 'whadmin@warehouse.local', password: 'WhAdmin@12345', tenantId: null, warehouseId: WAREHOUSE_ID },
  { label: 'TENANT_ADMIN', role: 'TENANT_ADMIN', fullName: 'Trần Thị Lan', email: 'tenant1admin@brand.local', password: 'Tenant1@12345', tenantId: TENANT_ID, warehouseId: null },
  { label: 'WH_STAFF', role: 'WH_STAFF', fullName: 'Lê Minh Đức', email: 'whstaff@warehouse.local', password: 'WhStaff@12345', tenantId: null, warehouseId: WAREHOUSE_ID, vehiclePlate: null },
  { label: 'WH_TRANSPORTER', role: 'WH_TRANSPORTER', fullName: 'Phạm Văn Tài', email: 'transporter@warehouse.local', password: 'Transporter@12345', tenantId: null, warehouseId: WAREHOUSE_ID, vehiclePlate: '51H-12345', driverId: '079123456789', carrierName: 'Smart Warehouse Transport' },
  { label: 'TENANT_STAFF', role: 'TENANT_STAFF', fullName: 'Hoàng Thị Mai', email: 'tenantstaff@brand.local', password: 'TenantStaff@12345', tenantId: TENANT_ID, warehouseId: null, vehiclePlate: null },
];

const TENANT = {
  tenantId: TENANT_ID,
  companyName: 'Brand A Fashion JSC',
  companyCode: 'BRAND-A',
  taxCode: '0312000001',
  contactName: 'Trần Thị Lan',
  contactEmail: 'tenant1admin@brand.local',
  contactPhone: '0901111111',
  address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
};

const CATEGORIES = ['Áo', 'Quần'];
const SEASONS = ['Xuân 2026', 'Hè 2026', 'Thu 2026', 'Đông 2026'];
const COLLECTIONS = ['Dòng cơ bản', 'Thời trang hàng ngày', 'Công sở', 'Cao cấp'];

const SKUS = [
  { skuCode: 'BRA-TS-BLK-M', productKind: 'T_SHIRT', productName: 'Áo thun basic đen', categoryName: 'Áo', collectionName: 'Dòng cơ bản', seasonName: 'Hè 2026', color: 'Đen', size: 'M', material: 'Cotton 100%', movementCategory: 'FAST' },
  { skuCode: 'BRA-JN-NVY-32', productKind: 'JEANS', productName: 'Quần jean slim xanh navy', categoryName: 'Quần', collectionName: 'Thời trang hàng ngày', seasonName: 'Hè 2026', color: 'Xanh navy', size: '32', material: 'Denim', movementCategory: 'NORMAL' },
  { skuCode: 'BRA-SH-WHT-L', productKind: 'SHIRT', productName: 'Áo sơ mi công sở trắng', categoryName: 'Áo', collectionName: 'Công sở', seasonName: 'Thu 2026', color: 'Trắng', size: 'L', material: 'Polyester', movementCategory: 'NORMAL' },
  { skuCode: 'BRA-PL-NVY-M', productKind: 'POLO', productName: 'Áo polo navy', categoryName: 'Áo', collectionName: 'Thời trang hàng ngày', seasonName: 'Hè 2026', color: 'Navy', size: 'M', material: 'Cotton pique', movementCategory: 'FAST' },
  { skuCode: 'BRA-HD-GRY-L', productKind: 'HOODIE', productName: 'Hoodie xám unisex', categoryName: 'Áo', collectionName: 'Cao cấp', seasonName: 'Đông 2026', color: 'Xám', size: 'L', material: 'Fleece', movementCategory: 'SLOW' },
];

const LPNS = [
  { lpnCode: `${LPN_PREFIX}0001`, boxType: 'MEDIUM', volumeUnits: 2, maxCapacity: 50, weightKg: 12.5, status: 'RECEIVING', details: [{ skuCode: 'BRA-TS-BLK-M', quantity: 24 }] },
  { lpnCode: `${LPN_PREFIX}0002`, boxType: 'LARGE', volumeUnits: 4, maxCapacity: 80, weightKg: 28, status: 'RECEIVING', details: [{ skuCode: 'BRA-JN-NVY-32', quantity: 15 }] },
  { lpnCode: `${LPN_PREFIX}0003`, boxType: 'SMALL', volumeUnits: 1, maxCapacity: 30, weightKg: 5.2, status: 'RECEIVING', details: [{ skuCode: 'BRA-TS-BLK-M', quantity: 10 }, { skuCode: 'BRA-SH-WHT-L', quantity: 8 }] },
  { lpnCode: `${LPN_PREFIX}0004`, boxType: 'MEDIUM', volumeUnits: 2, maxCapacity: 50, weightKg: 11.8, status: 'RECEIVING', details: [{ skuCode: 'BRA-PL-NVY-M', quantity: 20 }] },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function tableExists(tableName) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return r.rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, columnName]
  );
  return r.rows.length > 0;
}

async function lookupUser(email) {
  const r = await pool.query('SELECT user_id, email, role FROM users WHERE email = $1', [email.toLowerCase()]);
  return r.rows[0] ?? null;
}

async function lookupByName(table, idColumn, nameColumn, name) {
  const r = await pool.query(
    `SELECT ${idColumn} AS id FROM ${table} WHERE LOWER(${nameColumn}) = LOWER($1) LIMIT 1`,
    [name]
  );
  return r.rows[0]?.id ?? null;
}

async function lookupCollection(tenantId, collectionName) {
  const r = await pool.query(
    `SELECT collection_id AS id FROM collections
     WHERE tenant_id = $1 AND LOWER(collection_name) = LOWER($2) LIMIT 1`,
    [tenantId, collectionName]
  );
  return r.rows[0]?.id ?? null;
}

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

// ─── 1. Locations ──────────────────────────────────────────────────────────────
async function seedLocations() {
  if (!(await tableExists('cities'))) {
    log('locations', 'skip — bảng cities chưa có (chạy db:migrate:all)');
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const city of LOCATIONS) {
      const cityRes = await client.query(
        `INSERT INTO cities (city_code, city_name, display_order, is_active)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (city_code) DO UPDATE SET
           city_name = EXCLUDED.city_name, display_order = EXCLUDED.display_order, is_active = TRUE
         RETURNING city_id`,
        [city.cityCode, city.cityName, city.displayOrder]
      );
      const cityId = cityRes.rows[0].city_id;
      for (let i = 0; i < city.districts.length; i += 1) {
        await client.query(
          `INSERT INTO districts (city_id, district_name, display_order, is_active)
           VALUES ($1, $2, $3, TRUE)
           ON CONFLICT (city_id, district_name) DO UPDATE SET display_order = EXCLUDED.display_order, is_active = TRUE`,
          [cityId, city.districts[i], i + 1]
        );
      }
      log('locations', `${city.cityName}: ${city.districts.length} quận/huyện`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── 2. Accounts (tenant + warehouse + users) ──────────────────────────────────
async function seedAccounts() {
  const whExists = await pool.query('SELECT warehouse_id FROM warehouses WHERE warehouse_id = $1', [WAREHOUSE_ID]);
  if (whExists.rows.length === 0) {
    await pool.query(
      `INSERT INTO warehouses (warehouse_id, warehouse_code, warehouse_name, address, status)
       VALUES ($1, 'WH-HCM-01', 'Kho HCM Trung tâm', 'Quận 7, TP.HCM', 'ACTIVE')
       ON CONFLICT (warehouse_code) DO NOTHING`,
      [WAREHOUSE_ID]
    );
    log('accounts', 'warehouse WH-HCM-01 created');
  }

  const tenantExists = await pool.query('SELECT tenant_id FROM tenant_companies WHERE tenant_id = $1', [TENANT_ID]);
  if (tenantExists.rows.length === 0) {
    await pool.query(
      `INSERT INTO tenant_companies
         (tenant_id, company_name, company_code, tax_code, contact_name, contact_email, contact_phone, address, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')
       ON CONFLICT (company_code) DO NOTHING`,
      [TENANT.tenantId, TENANT.companyName, TENANT.companyCode, TENANT.taxCode,
        TENANT.contactName, TENANT.contactEmail, TENANT.contactPhone, TENANT.address]
    );
    log('accounts', `tenant ${TENANT.companyCode} created`);
  }

  for (const acc of ACCOUNTS) {
    const existing = await lookupUser(acc.email);
    if (existing) {
      if (acc.role === 'WH_TRANSPORTER' && acc.vehiclePlate) {
        await pool.query(
          `UPDATE users SET
             default_vehicle_plate = COALESCE(default_vehicle_plate, $2),
             default_driver_id_number = COALESCE(default_driver_id_number, $3),
             default_carrier_name = COALESCE(default_carrier_name, $4),
             updated_at = NOW()
           WHERE user_id = $1`,
          [existing.user_id, acc.vehiclePlate, acc.driverId ?? null, acc.carrierName ?? null]
        );
      }
      log('accounts', `${acc.label} exists: ${acc.email}`);
      continue;
    }
    const hash = await bcrypt.hash(acc.password, 10);
    await pool.query(
      `INSERT INTO users (tenant_id, warehouse_id, full_name, email, password_hash, role, status,
         default_vehicle_plate, default_driver_id_number, default_carrier_name)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $8, $9)`,
      [acc.tenantId, acc.warehouseId, acc.fullName, acc.email.toLowerCase(), hash, acc.role,
        acc.vehiclePlate ?? null, acc.driverId ?? null, acc.carrierName ?? null]
    );
    log('accounts', `${acc.label} created: ${acc.email}`);
  }
}

// ─── 3. Warehouse structure ────────────────────────────────────────────────────
const whStats = { warehouses: 0, zones: 0, racks: 0, levels: 0, bins: 0 };

async function upsertWarehouse(wh) {
  const result = await pool.query(
    `INSERT INTO warehouses
       (warehouse_id, warehouse_code, warehouse_name, address, city, district, total_area_m2, usable_area_m2, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')
     ON CONFLICT (warehouse_code) DO UPDATE SET
       warehouse_name = EXCLUDED.warehouse_name, address = EXCLUDED.address,
       city = EXCLUDED.city, district = EXCLUDED.district,
       total_area_m2 = EXCLUDED.total_area_m2, usable_area_m2 = EXCLUDED.usable_area_m2, updated_at = NOW()
     RETURNING warehouse_id, (xmax = 0) AS inserted`,
    [wh.warehouseId, wh.warehouseCode, wh.warehouseName, wh.address, wh.city, wh.district, wh.totalAreaM2, wh.usableAreaM2]
  );
  if (result.rows[0].inserted) whStats.warehouses += 1;
  return result.rows[0].warehouse_id;
}

async function upsertZone(warehouseId, zone) {
  const existing = await pool.query(
    'SELECT zone_id FROM warehouse_zones WHERE warehouse_id = $1 AND zone_code = $2',
    [warehouseId, zone.zoneCode]
  );
  if (existing.rows.length > 0) return existing.rows[0].zone_id;
  const r = await pool.query(
    `INSERT INTO warehouse_zones (warehouse_id, zone_code, zone_name, zone_type, area_m2, is_dedicated, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE') RETURNING zone_id`,
    [warehouseId, zone.zoneCode, zone.zoneName, zone.zoneType, zone.areaM2, zone.isDedicated]
  );
  whStats.zones += 1;
  return r.rows[0].zone_id;
}

async function upsertRack(zoneId, rack) {
  const existing = await pool.query('SELECT rack_id FROM racks WHERE zone_id = $1 AND rack_code = $2', [zoneId, rack.rackCode]);
  if (existing.rows.length > 0) return existing.rows[0].rack_id;
  const r = await pool.query(
    `INSERT INTO racks (zone_id, rack_code, rack_type, max_levels, status) VALUES ($1, $2, $3, $4, 'ACTIVE') RETURNING rack_id`,
    [zoneId, rack.rackCode, rack.rackType, rack.maxLevels]
  );
  whStats.racks += 1;
  return r.rows[0].rack_id;
}

async function upsertRackLevel(rackId, rackCode, levelNumber) {
  const existing = await pool.query(
    'SELECT rack_level_id FROM rack_levels WHERE rack_id = $1 AND level_number = $2',
    [rackId, levelNumber]
  );
  if (existing.rows.length > 0) return existing.rows[0].rack_level_id;
  const levelCode = `L-${String(levelNumber).padStart(2, '0')}`;
  const r = await pool.query(
    `INSERT INTO rack_levels (rack_id, level_code, level_number, max_bins, max_weight_kg, height_cm, level_priority)
     VALUES ($1, $2, $3, $4, 500, 180, $3) RETURNING rack_level_id`,
    [rackId, levelCode, levelNumber, BINS_PER_LEVEL]
  );
  whStats.levels += 1;
  return r.rows[0].rack_level_id;
}

async function upsertBin(rackLevelId, rackCode, levelNumber, binIndex) {
  const binCode = `B-${rackCode.replace(/^R-/, '')}-L${levelNumber}-${String(binIndex).padStart(2, '0')}`;
  const existing = await pool.query(
    'SELECT bin_id FROM bins WHERE rack_level_id = $1 AND bin_code = $2',
    [rackLevelId, binCode]
  );
  if (existing.rows.length > 0) return existing.rows[0].bin_id;
  const boxType = BOX_TYPES[(binIndex - 1) % BOX_TYPES.length];
  const r = await pool.query(
    `INSERT INTO bins (rack_level_id, bin_code, supported_box_type, max_lpn_count, max_volume_units, max_owner_count, reservation_type, status)
     VALUES ($1, $2, $3, 4, 16, 3, 'SHARED', 'EMPTY') RETURNING bin_id`,
    [rackLevelId, binCode, boxType]
  );
  whStats.bins += 1;
  return r.rows[0].bin_id;
}

async function seedWarehouseStructure() {
  for (const wh of WAREHOUSES) {
    const warehouseId = await upsertWarehouse(wh);
    for (const zone of wh.zones) {
      const zoneId = await upsertZone(warehouseId, zone);
      for (const rack of zone.racks) {
        const rackId = await upsertRack(zoneId, rack);
        for (let lvl = 1; lvl <= rack.maxLevels; lvl += 1) {
          const rackLevelId = await upsertRackLevel(rackId, rack.rackCode, lvl);
          for (let b = 1; b <= BINS_PER_LEVEL; b += 1) {
            await upsertBin(rackLevelId, rack.rackCode, lvl, b);
          }
        }
      }
    }
  }
  log('warehouse', `+${whStats.warehouses} WH, +${whStats.zones} zones, +${whStats.racks} racks, +${whStats.levels} levels, +${whStats.bins} bins`);
}

// ─── 4. Product master ───────────────────────────────────────────────────────
async function seedProductMaster() {
  for (const name of CATEGORIES) {
    const ex = await pool.query('SELECT category_id FROM categories WHERE LOWER(category_name) = LOWER($1)', [name]);
    if (ex.rows.length === 0) {
      await pool.query('INSERT INTO categories (category_name) VALUES ($1)', [name]);
    }
  }
  for (const name of SEASONS) {
    const ex = await pool.query('SELECT season_id FROM seasons WHERE LOWER(season_name) = LOWER($1)', [name]);
    if (ex.rows.length === 0) {
      await pool.query('INSERT INTO seasons (season_name) VALUES ($1)', [name]);
    }
  }
  log('product-master', `${CATEGORIES.length} categories, ${SEASONS.length} seasons`);
}

async function seedCollections() {
  for (const name of COLLECTIONS) {
    const ex = await pool.query(
      'SELECT collection_id FROM collections WHERE tenant_id = $1 AND LOWER(collection_name) = LOWER($2)',
      [TENANT_ID, name]
    );
    if (ex.rows.length === 0) {
      await pool.query('INSERT INTO collections (tenant_id, collection_name) VALUES ($1, $2)', [TENANT_ID, name]);
    }
  }
  log('collections', `${COLLECTIONS.length} bộ sưu tập cho ${TENANT.companyCode}`);
}

// ─── 5. Contract / inbound / SKU / LPN ─────────────────────────────────────────
async function ensureContract() {
  const ex = await pool.query('SELECT contract_id, status FROM contracts WHERE contract_code = $1', [CONTRACT_CODE]);
  if (ex.rows.length > 0) {
    if (ex.rows[0].status !== 'ACTIVE') {
      await pool.query(`UPDATE contracts SET status = 'ACTIVE', updated_at = NOW() WHERE contract_id = $1`, [ex.rows[0].contract_id]);
    }
    return ex.rows[0].contract_id;
  }
  const r = await pool.query(
    `INSERT INTO contracts (
       tenant_id, warehouse_id, contract_code, contract_name,
       contract_type, pricing_model, billing_cycle, start_date, end_date, status
     ) VALUES ($1, $2, $3, 'Hợp đồng thuê kho chia sẻ 2026 — Brand A',
       'SHARED_STORAGE', 'USAGE_BASED', 'MONTHLY', CURRENT_DATE, CURRENT_DATE + INTERVAL '365 days', 'ACTIVE')
     RETURNING contract_id`,
    [TENANT_ID, WAREHOUSE_ID, CONTRACT_CODE]
  );
  log('contract', CONTRACT_CODE);
  return r.rows[0].contract_id;
}

async function ensureInbound(contractId) {
  const ex = await pool.query('SELECT inbound_request_id FROM inbound_requests WHERE inbound_code = $1', [INBOUND_CODE]);
  if (ex.rows.length > 0) return ex.rows[0].inbound_request_id;
  const r = await pool.query(
    `INSERT INTO inbound_requests (tenant_id, contract_id, warehouse_id, inbound_code, expected_arrival_date, status)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '3 days', 'RECEIVING')
     RETURNING inbound_request_id`,
    [TENANT_ID, contractId, WAREHOUSE_ID, INBOUND_CODE]
  );
  log('inbound', INBOUND_CODE);
  return r.rows[0].inbound_request_id;
}

async function ensureBatch(inboundRequestId) {
  const ex = await pool.query('SELECT batch_id FROM batches WHERE batch_code = $1', [BATCH_CODE]);
  if (ex.rows.length > 0) return ex.rows[0].batch_id;
  const r = await pool.query(
    `INSERT INTO batches (inbound_request_id, batch_code, warehouse_received_at) VALUES ($1, $2, NOW()) RETURNING batch_id`,
    [inboundRequestId, BATCH_CODE]
  );
  log('batch', BATCH_CODE);
  return r.rows[0].batch_id;
}

async function seedSku(tenantId, spec) {
  const ex = await pool.query('SELECT * FROM skus WHERE tenant_id = $1 AND sku_code = $2', [tenantId, spec.skuCode]);
  if (ex.rows.length > 0) return { row: ex.rows[0], inserted: false };

  const categoryId = spec.categoryName ? await lookupByName('categories', 'category_id', 'category_name', spec.categoryName) : null;
  const seasonId = spec.seasonName ? await lookupByName('seasons', 'season_id', 'season_name', spec.seasonName) : null;
  const collectionId = spec.collectionName ? await lookupCollection(tenantId, spec.collectionName) : null;
  const hasProductKind = await columnExists('skus', 'product_kind');

  const cols = ['tenant_id', 'sku_code', 'product_name', 'category_id', 'collection_id', 'season_id', 'color', 'size', 'material', 'movement_category', 'status'];
  const vals = [tenantId, spec.skuCode, spec.productName, categoryId, collectionId, seasonId, spec.color, spec.size, spec.material, spec.movementCategory ?? 'NORMAL', 'ACTIVE'];
  if (hasProductKind && spec.productKind) {
    cols.push('product_kind');
    vals.push(spec.productKind);
  }

  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  const r = await pool.query(
    `INSERT INTO skus (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    vals
  );
  return { row: r.rows[0], inserted: true };
}

async function seedInboundItem(inboundRequestId, skuId, qty) {
  const ex = await pool.query(
    'SELECT inbound_request_item_id FROM inbound_request_items WHERE inbound_request_id = $1 AND sku_id = $2',
    [inboundRequestId, skuId]
  );
  if (ex.rows.length > 0) return;
  await pool.query(
    'INSERT INTO inbound_request_items (inbound_request_id, sku_id, expected_quantity) VALUES ($1, $2, $3)',
    [inboundRequestId, skuId, qty]
  );
}

async function seedLpn(tenantId, batchId, spec) {
  const ex = await pool.query('SELECT * FROM lpns WHERE lpn_code = $1', [spec.lpnCode]);
  if (ex.rows.length > 0) return { row: ex.rows[0], inserted: false };
  const r = await pool.query(
    `INSERT INTO lpns (tenant_id, batch_id, lpn_code, box_type, volume_units, max_capacity, weight_kg, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [tenantId, batchId, spec.lpnCode, spec.boxType, spec.volumeUnits, spec.maxCapacity, spec.weightKg, spec.status ?? 'RECEIVING']
  );
  return { row: r.rows[0], inserted: true };
}

async function seedLpnDetail(lpnId, skuId, quantity) {
  const ex = await pool.query('SELECT lpn_detail_id FROM lpn_details WHERE lpn_id = $1 AND sku_id = $2', [lpnId, skuId]);
  if (ex.rows.length > 0) return;
  await pool.query('INSERT INTO lpn_details (lpn_id, sku_id, quantity) VALUES ($1, $2, $3)', [lpnId, skuId, quantity]);
}

async function syncLpnTotals(lpnId) {
  const sumR = await pool.query('SELECT COALESCE(SUM(quantity), 0)::int AS total FROM lpn_details WHERE lpn_id = $1', [lpnId]);
  const total = sumR.rows[0].total;
  const lpnR = await pool.query('SELECT max_capacity FROM lpns WHERE lpn_id = $1', [lpnId]);
  const maxCap = lpnR.rows[0]?.max_capacity;
  let fillPct = null;
  if (maxCap != null && maxCap > 0) {
    fillPct = Math.min(100, Math.round((total / maxCap) * 10000) / 100);
  }
  await pool.query(
    'UPDATE lpns SET actual_quantity = $2, fill_percentage = $3, updated_at = NOW() WHERE lpn_id = $1',
    [lpnId, total, fillPct]
  );
}

async function seedSkuAndLpn(contractId, inboundRequestId, batchId) {
  const skuByCode = new Map();
  for (const spec of SKUS) {
    const { row, inserted } = await seedSku(TENANT_ID, spec);
    skuByCode.set(spec.skuCode, row.sku_id);
    log('sku', `${inserted ? '+' : '='} ${row.sku_code} — ${row.product_name}`);
    await seedInboundItem(inboundRequestId, row.sku_id, 100);
  }

  for (const spec of LPNS) {
    const { row: lpn, inserted } = await seedLpn(TENANT_ID, batchId, spec);
    log('lpn', `${inserted ? '+' : '='} ${lpn.lpn_code}`);
    for (const line of spec.details) {
      const skuId = skuByCode.get(line.skuCode);
      if (!skuId) throw new Error(`SKU not found: ${line.skuCode}`);
      await seedLpnDetail(lpn.lpn_id, skuId, line.quantity);
    }
    await syncLpnTotals(lpn.lpn_id);
  }
}

// ─── 6. Extended flows ─────────────────────────────────────────────────────────
async function pickFirstBin(warehouseId) {
  const r = await pool.query(
    `SELECT b.bin_id, b.bin_code, rl.rack_level_id, r.rack_id, z.zone_id
     FROM bins b
     JOIN rack_levels rl ON b.rack_level_id = rl.rack_level_id
     JOIN racks r ON rl.rack_id = r.rack_id
     JOIN warehouse_zones z ON r.zone_id = z.zone_id
     WHERE z.warehouse_id = $1 ORDER BY b.bin_code LIMIT 1`,
    [warehouseId]
  );
  if (r.rows.length === 0) throw new Error('No bins — chạy seed warehouse trước');
  return r.rows[0];
}

async function ensureBranch() {
  if (!(await tableExists('branches'))) return null;
  const whAdmin = await lookupUser('whadmin@warehouse.local');
  const ex = await pool.query('SELECT branch_id FROM branches WHERE branch_code = $1', [BRANCH_CODE]);
  if (ex.rows.length > 0) return ex.rows[0].branch_id;
  const r = await pool.query(
    `INSERT INTO branches (manager_id, branch_code, branch_name, city, is_active)
     VALUES ($1, $2, 'Chi nhánh HCM Trung tâm', 'TP.HCM', TRUE) RETURNING branch_id`,
    [whAdmin?.user_id ?? null, BRANCH_CODE]
  );
  log('branch', BRANCH_CODE);
  return r.rows[0].branch_id;
}

async function ensureRentalRequest(contractId) {
  let rentalRequestId;
  const ex = await pool.query('SELECT rental_request_id FROM rental_requests WHERE request_code = $1', [RENTAL_CODE]);
  if (ex.rows.length > 0) {
    rentalRequestId = ex.rows[0].rental_request_id;
  } else {
    const r = await pool.query(
      `INSERT INTO rental_requests (
         request_code, tenant_id, city, district, warehouse_id,
         contract_type, pricing_model, billing_cycle,
         estimated_sku_count, estimated_box_count, requested_area_m2, status, notes
       ) VALUES ($1, $2, 'TP.HCM', 'Quận 7', $3, 'SHARED_STORAGE', 'USAGE_BASED', 'MONTHLY',
         500, 120, 80, 'APPROVED', 'Yêu cầu thuê kho chia sẻ 80m² — Brand A tháng 6/2026')
       RETURNING rental_request_id`,
      [RENTAL_CODE, TENANT_ID, WAREHOUSE_ID]
    );
    rentalRequestId = r.rows[0].rental_request_id;
    log('rental', RENTAL_CODE);
  }

  const lineEx = await pool.query(
    'SELECT line_id FROM rental_request_product_lines WHERE rental_request_id = $1 LIMIT 1',
    [rentalRequestId]
  );
  if (lineEx.rows.length === 0 && (await tableExists('rental_request_product_lines'))) {
    await pool.query(
      `INSERT INTO rental_request_product_lines (
         rental_request_id, product_kind, size, size_group, quantity,
         base_volume_units_per_piece, size_factor, final_volume_units_per_piece, line_volume_units, sort_order
       ) VALUES ($1, 'T_SHIRT', 'M', 'M_L', 200, 0.5, 1.0, 0.5, 100, 1)`,
      [rentalRequestId]
    );
    await pool.query(
      `INSERT INTO rental_request_product_lines (
         rental_request_id, product_kind, size, size_group, quantity,
         base_volume_units_per_piece, size_factor, final_volume_units_per_piece, line_volume_units, sort_order
       ) VALUES ($1, 'JEANS', '32', 'M_L', 80, 1.0, 1.0, 1.0, 80, 2)`,
      [rentalRequestId]
    );
    log('rental-lines', '2 dòng sản phẩm');
  }

  await pool.query(
    'UPDATE rental_requests SET total_committed_volume_units = 180, updated_at = NOW() WHERE rental_request_id = $1',
    [rentalRequestId]
  );
  await pool.query(
    'UPDATE contracts SET rental_request_id = $2, updated_at = NOW() WHERE contract_id = $1 AND rental_request_id IS DISTINCT FROM $2',
    [contractId, rentalRequestId]
  );
  return rentalRequestId;
}

async function ensureContractItems(contractId) {
  const ex = await pool.query('SELECT contract_item_id FROM contract_items WHERE contract_id = $1 LIMIT 1', [contractId]);
  if (ex.rows.length > 0) return;
  await pool.query(
    `INSERT INTO contract_items (contract_id, item_type, storage_level, billing_unit, quantity, unit_price)
     VALUES ($1, 'STORAGE', 'BIN', 'BIN_DAY', 10, 50000)`,
    [contractId]
  );
  await pool.query(
    `INSERT INTO contract_items (contract_id, item_type, billing_unit, quantity, unit_price)
     VALUES ($1, 'INBOUND', 'INBOUND_LPN', 100, 15000)`,
    [contractId]
  );
  log('contract-items', '2 dòng');
}

async function ensureStorageReservation(contractId, binRow) {
  const ex = await pool.query('SELECT reservation_id FROM storage_reservations WHERE contract_id = $1 LIMIT 1', [contractId]);
  if (ex.rows.length > 0) return;
  await pool.query(
    `INSERT INTO storage_reservations (
       contract_id, tenant_id, reservation_type, storage_level,
       warehouse_id, zone_id, rack_id, rack_level_id, bin_id,
       reserved_capacity, box_type, start_date, end_date, status
     ) VALUES ($1, $2, 'SHARED', 'BIN', $3, $4, $5, $6, $7, 16, 'MEDIUM', CURRENT_DATE, CURRENT_DATE + INTERVAL '365 days', 'ACTIVE')`,
    [contractId, TENANT_ID, WAREHOUSE_ID, binRow.zone_id, binRow.rack_id, binRow.rack_level_id, binRow.bin_id]
  );
  log('storage-reservation', binRow.bin_code);
}

async function ensurePricingPolicies() {
  const ex = await pool.query(
    `SELECT pricing_policy_id FROM pricing_policies
     WHERE warehouse_id = $1 AND contract_type = 'SHARED_STORAGE' AND billing_unit = 'BIN_DAY' LIMIT 1`,
    [WAREHOUSE_ID]
  );
  if (ex.rows.length > 0) return;
  await pool.query(
    `INSERT INTO pricing_policies (warehouse_id, contract_type, storage_level, billing_unit, box_type, price, effective_from)
     VALUES ($1, 'SHARED_STORAGE', 'BIN', 'BIN_DAY', 'MEDIUM', 50000, NOW())`,
    [WAREHOUSE_ID]
  );
  log('pricing', 'BIN_DAY MEDIUM 50.000đ');
}

async function ensureInboundDelivery(inboundRequestId) {
  if (!(await tableExists('inbound_deliveries'))) return;
  const ex = await pool.query('SELECT inbound_delivery_id FROM inbound_deliveries WHERE inbound_request_id = $1', [inboundRequestId]);
  if (ex.rows.length > 0) return;
  const transporter = await lookupUser('transporter@warehouse.local');
  await pool.query(
    `INSERT INTO inbound_deliveries (
       inbound_request_id, tenant_id, vehicle_plate, driver_name, driver_phone,
       carrier_name, scheduled_at, pickup_address, pickup_contact_name, pickup_contact_phone, assigned_driver_user_id
     ) VALUES ($1, $2, '51H-67890', 'Phạm Văn Tài', '0908765432',
       'Brand A Logistics', NOW() + INTERVAL '1 day',
       'Kho xưởng Brand A, KCN Tân Bình, TP.HCM', 'Trần Thị Lan', '0901111111', $3)`,
    [inboundRequestId, TENANT_ID, transporter?.user_id ?? null]
  );
  log('inbound-delivery', INBOUND_CODE);
}

async function ensureInventories(binRow, whStaffId) {
  const details = await pool.query(
    `SELECT ld.lpn_detail_id, ld.lpn_id, ld.sku_id, ld.quantity, l.tenant_id, l.batch_id, l.lpn_code
     FROM lpn_details ld JOIN lpns l ON l.lpn_id = ld.lpn_id
     WHERE l.lpn_code LIKE $1 ORDER BY l.lpn_code`,
    [`${LPN_PREFIX}%`]
  );
  const inventoryRows = [];
  for (const row of details.rows) {
    const ex = await pool.query('SELECT inventory_id FROM inventories WHERE lpn_id = $1 AND sku_id = $2', [row.lpn_id, row.sku_id]);
    let inventoryId;
    if (ex.rows.length > 0) {
      inventoryId = ex.rows[0].inventory_id;
    } else {
      const ins = await pool.query(
        `INSERT INTO inventories (tenant_id, sku_id, batch_id, lpn_id, bin_id, quantity, reserved_quantity, available_quantity, status, received_at)
         VALUES ($1, $2, $3, $4, $5, $6, 0, $6, 'AVAILABLE', NOW()) RETURNING inventory_id`,
        [row.tenant_id, row.sku_id, row.batch_id, row.lpn_id, binRow.bin_id, row.quantity]
      );
      inventoryId = ins.rows[0].inventory_id;
      await pool.query(
        `INSERT INTO inventory_movements (inventory_id, movement_type, to_bin_id, quantity, moved_by, note)
         VALUES ($1, 'PUTAWAY', $2, $3, $4, 'Nhập kho và cất vào vị trí')`,
        [inventoryId, binRow.bin_id, row.quantity, whStaffId]
      );
    }
    inventoryRows.push({ inventoryId, ...row });
    await pool.query(
      `UPDATE lpns SET current_bin_id = $2, status = 'STORED', updated_at = NOW() WHERE lpn_id = $1`,
      [row.lpn_id, binRow.bin_id]
    );
  }
  log('inventories', `${inventoryRows.length} tồn kho`);
  return inventoryRows;
}

async function ensureInvoice(contractId) {
  const ex = await pool.query('SELECT invoice_id FROM invoices WHERE invoice_code = $1', [INVOICE_CODE]);
  let invoiceId;
  if (ex.rows.length > 0) {
    invoiceId = ex.rows[0].invoice_id;
  } else {
    const r = await pool.query(
      `INSERT INTO invoices (
         tenant_id, contract_id, invoice_code, billing_start_date, billing_end_date,
         subtotal, tax, total_amount, payment_status, issued_at, due_date, invoice_category
       ) VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
         5000000, 500000, 5500000, 'PENDING', NOW(), CURRENT_DATE + INTERVAL '14 days', 'INITIAL')
       RETURNING invoice_id`,
      [TENANT_ID, contractId, INVOICE_CODE]
    );
    invoiceId = r.rows[0].invoice_id;
    log('invoice', INVOICE_CODE);
  }

  const itemEx = await pool.query('SELECT invoice_item_id FROM invoice_items WHERE invoice_id = $1 LIMIT 1', [invoiceId]);
  if (itemEx.rows.length === 0) {
    await pool.query(
      `INSERT INTO invoice_items (invoice_id, item_type, description, quantity, unit_price, total_price)
       VALUES ($1, 'STORAGE', 'Phí thuê kho tháng 6/2026', 1, 5000000, 5000000)`,
      [invoiceId]
    );
  }

  const payEx = await pool.query('SELECT payment_id FROM payments WHERE invoice_id = $1 LIMIT 1', [invoiceId]);
  if (payEx.rows.length === 0) {
    await pool.query(
      `INSERT INTO payments (invoice_id, amount, payment_method, payment_status, transaction_code)
       VALUES ($1, 5500000, 'BANK_TRANSFER', 'PENDING', $2)`,
      [invoiceId, PAYMENT_TXN]
    );
    log('payment', PAYMENT_TXN);
  }
  return invoiceId;
}

async function ensureContractAppendix(contractId) {
  if (!(await tableExists('contract_appendices'))) return null;
  const ex = await pool.query('SELECT appendix_id FROM contract_appendices WHERE appendix_code = $1', [APPENDIX_CODE]);
  if (ex.rows.length > 0) return ex.rows[0].appendix_id;
  const tenantAdmin = await lookupUser('tenant1admin@brand.local');
  const r = await pool.query(
    `INSERT INTO contract_appendices (
       contract_id, appendix_code, appendix_number, title, status,
       effective_date, end_date, estimated_delta_amount, max_storage_level, created_by
     ) VALUES ($1, $2, 1, 'Phụ lục mở rộng thêm 5 bin — Q3/2026', 'PENDING',
       CURRENT_DATE + INTERVAL '90 days', CURRENT_DATE + INTERVAL '455 days', 2500000, 'BIN', $3)
     RETURNING appendix_id`,
    [contractId, APPENDIX_CODE, tenantAdmin?.user_id ?? null]
  );
  log('appendix', APPENDIX_CODE);
  return r.rows[0].appendix_id;
}

async function ensureContractTermination(contractId) {
  if (!(await tableExists('contract_termination_requests'))) return;
  const ex = await pool.query(
    'SELECT termination_request_id FROM contract_termination_requests WHERE contract_id = $1 LIMIT 1',
    [contractId]
  );
  if (ex.rows.length > 0) return;
  const tenantAdmin = await lookupUser('tenant1admin@brand.local');
  await pool.query(
    `INSERT INTO contract_termination_requests (
       contract_id, tenant_id, requested_by, status, billing_cycle,
       has_inbound, total_paid, monthly_rate, contract_months, used_months, unused_months,
       processing_fee, termination_fee, refund_amount, reason
     ) VALUES ($1, $2, $3, 'PENDING', 'MONTHLY', TRUE, 5500000, 5000000, 12, 2, 10, 200000, 0, 0,
       'Brand A yêu cầu chấm dứt hợp đồng sớm — đang chờ duyệt')`,
    [contractId, TENANT_ID, tenantAdmin?.user_id ?? null]
  );
  log('termination', 'PENDING request');
}

async function ensureOutboundFlow(contractId, inventoryRows, binRow) {
  const ex = await pool.query('SELECT outbound_request_id FROM outbound_requests WHERE outbound_code = $1', [OUTBOUND_CODE]);
  let outboundId;
  if (ex.rows.length > 0) {
    outboundId = ex.rows[0].outbound_request_id;
  } else {
    const tenantAdmin = await lookupUser('tenant1admin@brand.local');
    const r = await pool.query(
      `INSERT INTO outbound_requests (tenant_id, contract_id, warehouse_id, outbound_code, requested_ship_date, status, created_by)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '2 days', 'APPROVED', $5) RETURNING outbound_request_id`,
      [TENANT_ID, contractId, WAREHOUSE_ID, OUTBOUND_CODE, tenantAdmin?.user_id ?? null]
    );
    outboundId = r.rows[0].outbound_request_id;
    log('outbound', OUTBOUND_CODE);
  }

  const firstInv = inventoryRows[0];
  if (!firstInv) return outboundId;

  const itemEx = await pool.query(
    'SELECT outbound_request_item_id FROM outbound_request_items WHERE outbound_request_id = $1 AND sku_id = $2',
    [outboundId, firstInv.sku_id]
  );
  if (itemEx.rows.length === 0) {
    await pool.query(
      'INSERT INTO outbound_request_items (outbound_request_id, sku_id, requested_quantity, allocated_quantity) VALUES ($1, $2, 5, 5)',
      [outboundId, firstInv.sku_id]
    );
  }

  const taskEx = await pool.query('SELECT picking_task_id FROM picking_tasks WHERE outbound_request_id = $1 LIMIT 1', [outboundId]);
  let pickingTaskId;
  if (taskEx.rows.length > 0) {
    pickingTaskId = taskEx.rows[0].picking_task_id;
  } else {
    const whStaff = await lookupUser('whstaff@warehouse.local');
    const t = await pool.query(
      `INSERT INTO picking_tasks (outbound_request_id, assigned_to, status) VALUES ($1, $2, 'PENDING') RETURNING picking_task_id`,
      [outboundId, whStaff?.user_id ?? null]
    );
    pickingTaskId = t.rows[0].picking_task_id;
    log('picking', OUTBOUND_CODE);
  }

  const ptiEx = await pool.query('SELECT picking_task_item_id FROM picking_task_items WHERE picking_task_id = $1 LIMIT 1', [pickingTaskId]);
  if (ptiEx.rows.length === 0) {
    await pool.query(
      `INSERT INTO picking_task_items (picking_task_id, inventory_id, lpn_id, bin_id, batch_id, quantity_to_pick)
       VALUES ($1, $2, $3, $4, $5, 5)`,
      [pickingTaskId, firstInv.inventoryId, firstInv.lpn_id, binRow.bin_id, firstInv.batch_id]
    );
  }

  const shipEx = await pool.query('SELECT shipment_id FROM shipments WHERE shipment_code = $1', [SHIPMENT_CODE]);
  if (shipEx.rows.length === 0) {
    await pool.query(
      `INSERT INTO shipments (tenant_id, outbound_request_id, shipment_code, carrier_name, vehicle_plate, driver_name, status)
       VALUES ($1, $2, $3, 'Giao Hàng Nhanh', '51H-88888', 'Nguyễn Văn Giao', 'READY')`,
      [TENANT_ID, outboundId, SHIPMENT_CODE]
    );
    log('shipment', SHIPMENT_CODE);
  }

  if (await tableExists('outbound_deliveries')) {
    const odEx = await pool.query('SELECT outbound_delivery_id FROM outbound_deliveries WHERE outbound_request_id = $1', [outboundId]);
    if (odEx.rows.length === 0) {
      const transporter = await lookupUser('transporter@warehouse.local');
      await pool.query(
        `INSERT INTO outbound_deliveries (
           outbound_request_id, tenant_id, vehicle_plate, driver_name, driver_phone,
           carrier_name, ship_to_address, ship_to_contact_name, ship_to_contact_phone,
           assigned_driver_user_id, delivery_status
         ) VALUES ($1, $2, '51H-88888', 'Nguyễn Văn Giao', '0909888777',
           'Giao Hàng Nhanh', '456 Lê Lợi, Quận 1, TP.HCM', 'Trần Thị Lan', '0901111111', $3, 'PENDING')`,
        [outboundId, TENANT_ID, transporter?.user_id ?? null]
      );
      log('outbound-delivery', OUTBOUND_CODE);
    }
  }

  return outboundId;
}

async function ensureAnalytics(contractId, binRow) {
  const usageEx = await pool.query(
    `SELECT snapshot_id FROM storage_usage_snapshots
     WHERE tenant_id = $1 AND contract_id = $2 AND snapshot_date = CURRENT_DATE LIMIT 1`,
    [TENANT_ID, contractId]
  );
  if (usageEx.rows.length === 0) {
    await pool.query(
      `INSERT INTO storage_usage_snapshots (tenant_id, contract_id, snapshot_date, storage_level, billing_unit, box_type, occupied_count, calculated_fee)
       VALUES ($1, $2, CURRENT_DATE, 'BIN', 'BIN_DAY', 'MEDIUM', 3, 150000)`,
      [TENANT_ID, contractId]
    );
  }

  const occEx = await pool.query(
    `SELECT occupancy_snapshot_id FROM occupancy_snapshots
     WHERE warehouse_id = $1 AND zone_id = $2 AND snapshot_date = CURRENT_DATE LIMIT 1`,
    [WAREHOUSE_ID, binRow.zone_id]
  );
  if (occEx.rows.length === 0) {
    await pool.query(
      `INSERT INTO occupancy_snapshots (warehouse_id, zone_id, occupancy_rate, available_capacity, snapshot_date)
       VALUES ($1, $2, 0.35, 100, CURRENT_DATE)`,
      [WAREHOUSE_ID, binRow.zone_id]
    );
  }

  const skuR = await pool.query(
    'SELECT sku_id FROM skus WHERE tenant_id = $1 AND sku_code = $2',
    [TENANT_ID, 'BRA-TS-BLK-M']
  );
  if (skuR.rows.length > 0) {
    const anaEx = await pool.query('SELECT analytics_id FROM sku_movement_analytics WHERE sku_id = $1 LIMIT 1', [skuR.rows[0].sku_id]);
    if (anaEx.rows.length === 0) {
      await pool.query(
        `INSERT INTO sku_movement_analytics (sku_id, snapshot_date, inbound_qty, outbound_qty, picking_count, average_storage_days, turnover_score, movement_category)
         VALUES ($1, CURRENT_DATE, 100, 20, 5, 14.5, 0.82, 'FAST')`,
        [skuR.rows[0].sku_id]
      );
    }
  }

  const inboundR = await pool.query('SELECT inbound_request_id FROM inbound_requests WHERE inbound_code = $1', [INBOUND_CODE]);
  const lpnR = await pool.query(
    `SELECT l.lpn_id, ld.sku_id FROM lpns l JOIN lpn_details ld ON ld.lpn_id = l.lpn_id WHERE l.lpn_code = $1 LIMIT 1`,
    [`${LPN_PREFIX}0001`]
  );
  if (inboundR.rows.length > 0 && lpnR.rows.length > 0) {
    const aiEx = await pool.query('SELECT recommendation_id FROM ai_slot_recommendations WHERE lpn_id = $1 LIMIT 1', [lpnR.rows[0].lpn_id]);
    if (aiEx.rows.length === 0) {
      await pool.query(
        `INSERT INTO ai_slot_recommendations (inbound_request_id, lpn_id, sku_id, recommended_zone_id, recommended_bin_id, recommendation_score, reason, is_applied)
         VALUES ($1, $2, $3, $4, $5, 0.92, 'Gần khu hàng xoay nhanh B01', FALSE)`,
        [inboundR.rows[0].inbound_request_id, lpnR.rows[0].lpn_id, lpnR.rows[0].sku_id, binRow.zone_id, binRow.bin_id]
      );
    }
  }
  log('analytics', 'snapshots + AI recommendation');
}

async function printSummary() {
  const tables = [
    'tenant_companies', 'warehouses', 'users', 'warehouse_zones', 'racks', 'bins',
    'categories', 'seasons', 'collections', 'skus', 'contracts', 'inbound_requests',
    'lpns', 'inventories', 'outbound_requests', 'invoices', 'rental_requests',
  ];
  console.log('\n─── Row counts ───');
  for (const t of tables) {
    if (await tableExists(t)) {
      const r = await pool.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
      console.log(`  ${t}: ${r.rows[0].c}`);
    }
  }
  const catalogs = ['garment_category_groups', 'product_kind_catalog', 'size_factor_catalog', 'cities', 'districts'];
  for (const t of catalogs) {
    if (await tableExists(t)) {
      const r = await pool.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
      console.log(`  ${t}: ${r.rows[0].c} (migration catalog)`);
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────
try {
  console.log('=== seed-all (production-like data) ===\n');

  await seedLocations();
  await seedAccounts();
  await seedWarehouseStructure();
  await seedProductMaster();
  await seedCollections();

  const contractId = await ensureContract();
  const inboundRequestId = await ensureInbound(contractId);
  const batchId = await ensureBatch(inboundRequestId);
  await seedSkuAndLpn(contractId, inboundRequestId, batchId);

  const binRow = await pickFirstBin(WAREHOUSE_ID);
  await ensureBranch();
  await ensureRentalRequest(contractId);
  await ensureContractItems(contractId);
  await ensureStorageReservation(contractId, binRow);
  await ensurePricingPolicies();
  await ensureInboundDelivery(inboundRequestId);

  const whStaff = await lookupUser('whstaff@warehouse.local');
  const inventoryRows = await ensureInventories(binRow, whStaff?.user_id ?? null);
  await ensureInvoice(contractId);
  await ensureContractAppendix(contractId);
  await ensureContractTermination(contractId);
  await ensureOutboundFlow(contractId, inventoryRows, binRow);
  await ensureAnalytics(contractId, binRow);
  await printSummary();

  console.log('\n=== Hoàn tất ===');
  console.log('Tài khoản đăng nhập:');
  console.log('  SYSTEM_ADMIN:  admin@warehouse.local / admin12345');
  console.log('  WH_ADMIN:      whadmin@warehouse.local / WhAdmin@12345');
  console.log('  TENANT_ADMIN:  tenant1admin@brand.local / Tenant1@12345');
  console.log('  WH_STAFF:      whstaff@warehouse.local / WhStaff@12345');
  console.log('  WH_TRANSPORTER: transporter@warehouse.local / Transporter@12345');
  console.log('  TENANT_STAFF:  tenantstaff@brand.local / TenantStaff@12345');
} catch (err) {
  console.error('seed-all failed:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
