/**
 * Seed cấu trúc kho mẫu cho warehouse `WH-HCM-01`:
 *   Warehouse → Zones → Racks → Rack Levels → Bins
 *
 * Usage: npm run seed:warehouse
 *
 * Idempotent — dùng ON CONFLICT theo unique key của từng bảng:
 *   - warehouses(warehouse_code)
 *   - warehouse_zones(warehouse_id, zone_code)
 *   - racks(zone_id, rack_code)
 *   - rack_levels(rack_id, level_number)
 *   - bins(rack_level_id, bin_code)
 */
import 'dotenv/config';
import pool from '../src/config/db.js';

const PRIMARY_WAREHOUSE_ID = '2084bdca-8320-439c-8e37-e0d37fa3d7c9';

// Warehouse chính (HCM) — đầy đủ zones/racks/levels/bins cho demo Flow 1 + Flow 2.
const PRIMARY_WAREHOUSE = {
  warehouseId: PRIMARY_WAREHOUSE_ID,
  warehouseCode: 'WH-HCM-01',
  warehouseName: 'Kho HCM Trung tâm',
  address: 'Quận 7, TP.HCM',
  city: 'TP.HCM',
  district: 'Quận 7',
  totalAreaM2: 5000,
  usableAreaM2: 4200,
  // 4 zone chính + 2 zone hỗ trợ (QC, RETURN).
  // Mỗi zone main có vài rack; QC/RETURN để trống cho test thủ công.
  zones: [
    {
      zoneCode: 'Z-A01',
      zoneName: 'Shared A01',
      zoneType: 'SHARED',
      areaM2: 800,
      isDedicated: false,
      racks: [
        { rackCode: 'R-A01-01', rackType: 'STANDARD', maxLevels: 4 },
        { rackCode: 'R-A01-02', rackType: 'STANDARD', maxLevels: 4 },
      ],
    },
    {
      zoneCode: 'Z-B01',
      zoneName: 'Fast moving B01',
      zoneType: 'FAST_MOVING',
      areaM2: 600,
      isDedicated: false,
      racks: [
        { rackCode: 'R-B01-01', rackType: 'STANDARD', maxLevels: 3 },
        { rackCode: 'R-B01-02', rackType: 'STANDARD', maxLevels: 3 },
      ],
    },
    {
      zoneCode: 'Z-C01',
      zoneName: 'Shared C01',
      zoneType: 'SHARED',
      areaM2: 900,
      isDedicated: false,
      racks: [
        { rackCode: 'R-C01-01', rackType: 'STANDARD', maxLevels: 3 },
        { rackCode: 'R-C01-02', rackType: 'STANDARD', maxLevels: 3 },
      ],
    },
    {
      zoneCode: 'Z-P01',
      zoneName: 'Premium P01',
      zoneType: 'PREMIUM',
      areaM2: 400,
      isDedicated: true,
      racks: [{ rackCode: 'R-P01-01', rackType: 'STANDARD', maxLevels: 3 }],
    },
    {
      zoneCode: 'Z-RET',
      zoneName: 'Return Area',
      zoneType: 'RETURN',
      areaM2: 200,
      isDedicated: false,
      racks: [],
    },
  ],
};

// 2 warehouse phụ — đầy đủ rack / level / bin (scale nhỏ hơn warehouse chính).
const EXTRA_WAREHOUSES = [
  {
    warehouseId: '3a0e2b71-1c4f-4d2a-9b35-7c8b50d2b101',
    warehouseCode: 'WH-HCM-02',
    warehouseName: 'Kho HCM Quận 9',
    address: 'TP. Thủ Đức, TP.HCM',
    city: 'TP.HCM',
    district: 'Quận 9',
    totalAreaM2: 3500,
    usableAreaM2: 3000,
    zones: [
      {
        zoneCode: 'Z-A01',
        zoneName: 'Shared A01',
        zoneType: 'SHARED',
        areaM2: 700,
        isDedicated: false,
        racks: [
          { rackCode: 'R-A01-01', rackType: 'STANDARD', maxLevels: 3 },
          { rackCode: 'R-A01-02', rackType: 'STANDARD', maxLevels: 3 },
        ],
      },
      {
        zoneCode: 'Z-B01',
        zoneName: 'Fast moving B01',
        zoneType: 'FAST_MOVING',
        areaM2: 500,
        isDedicated: false,
        racks: [{ rackCode: 'R-B01-01', rackType: 'STANDARD', maxLevels: 3 }],
      },
    ],
  },
  {
    warehouseId: '4b1d3e82-2d5f-4e3a-8c46-8d9c61e3c202',
    warehouseCode: 'WH-HN-01',
    warehouseName: 'Kho Hà Nội Long Biên',
    address: 'Long Biên, Hà Nội',
    city: 'Hà Nội',
    district: 'Long Biên',
    totalAreaM2: 4000,
    usableAreaM2: 3400,
    zones: [
      {
        zoneCode: 'Z-A01',
        zoneName: 'Shared A01',
        zoneType: 'SHARED',
        areaM2: 750,
        isDedicated: false,
        racks: [
          { rackCode: 'R-A01-01', rackType: 'STANDARD', maxLevels: 3 },
          { rackCode: 'R-A01-02', rackType: 'STANDARD', maxLevels: 3 },
        ],
      },
      {
        zoneCode: 'Z-C01',
        zoneName: 'Premium C01',
        zoneType: 'PREMIUM',
        areaM2: 850,
        isDedicated: false,
        racks: [{ rackCode: 'R-C01-01', rackType: 'STANDARD', maxLevels: 3 }],
      },
    ],
  },
];

const WAREHOUSES = [PRIMARY_WAREHOUSE, ...EXTRA_WAREHOUSES];

// 4 bin / level, alternate SMALL & MEDIUM
const BINS_PER_LEVEL = 4;
const BOX_TYPES = ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA'];

const stats = {
  warehouses: { inserted: 0, skipped: 0 },
  zones: { inserted: 0, skipped: 0 },
  racks: { inserted: 0, skipped: 0 },
  levels: { inserted: 0, skipped: 0 },
  bins: { inserted: 0, skipped: 0 },
};

async function ensureWarehouse(wh) {
  const result = await pool.query(
    `INSERT INTO warehouses
       (warehouse_id, warehouse_code, warehouse_name, address, city, district,
        total_area_m2, usable_area_m2, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')
     ON CONFLICT (warehouse_code) DO UPDATE
       SET warehouse_name = EXCLUDED.warehouse_name,
           address = EXCLUDED.address,
           city = EXCLUDED.city,
           district = EXCLUDED.district,
           total_area_m2 = EXCLUDED.total_area_m2,
           usable_area_m2 = EXCLUDED.usable_area_m2,
           updated_at = NOW()
     RETURNING warehouse_id,
       (xmax = 0) AS inserted`,
    [
      wh.warehouseId,
      wh.warehouseCode,
      wh.warehouseName,
      wh.address,
      wh.city,
      wh.district,
      wh.totalAreaM2,
      wh.usableAreaM2,
    ]
  );

  const row = result.rows[0];
  if (row.inserted) {
    stats.warehouses.inserted++;
    console.log('Created warehouse:', wh.warehouseCode);
  } else {
    stats.warehouses.skipped++;
    console.log('Updated warehouse region:', wh.warehouseCode, '→', wh.city, wh.district);
  }
  return row.warehouse_id;
}

async function upsertZone(warehouseId, zone) {
  const existing = await pool.query(
    'SELECT zone_id FROM warehouse_zones WHERE warehouse_id = $1 AND zone_code = $2',
    [warehouseId, zone.zoneCode]
  );
  if (existing.rows.length > 0) {
    stats.zones.skipped++;
    return existing.rows[0].zone_id;
  }

  const result = await pool.query(
    `INSERT INTO warehouse_zones
       (warehouse_id, zone_code, zone_name, zone_type, area_m2, is_dedicated, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
     RETURNING zone_id`,
    [
      warehouseId,
      zone.zoneCode,
      zone.zoneName,
      zone.zoneType,
      zone.areaM2,
      zone.isDedicated,
    ]
  );
  stats.zones.inserted++;
  return result.rows[0].zone_id;
}

async function upsertRack(zoneId, rack) {
  const existing = await pool.query(
    'SELECT rack_id FROM racks WHERE zone_id = $1 AND rack_code = $2',
    [zoneId, rack.rackCode]
  );
  if (existing.rows.length > 0) {
    stats.racks.skipped++;
    return { rackId: existing.rows[0].rack_id, isNew: false };
  }

  const result = await pool.query(
    `INSERT INTO racks (zone_id, rack_code, rack_type, max_levels, status)
     VALUES ($1, $2, $3, $4, 'ACTIVE')
     RETURNING rack_id`,
    [zoneId, rack.rackCode, rack.rackType, rack.maxLevels]
  );
  stats.racks.inserted++;
  return { rackId: result.rows[0].rack_id, isNew: true };
}

async function upsertRackLevel(rackId, rackCode, levelNumber, priority) {
  const existing = await pool.query(
    'SELECT rack_level_id FROM rack_levels WHERE rack_id = $1 AND level_number = $2',
    [rackId, levelNumber]
  );
  if (existing.rows.length > 0) {
    stats.levels.skipped++;
    return { rackLevelId: existing.rows[0].rack_level_id, isNew: false };
  }

  const levelCode = `L-${String(levelNumber).padStart(2, '0')}`;
  const result = await pool.query(
    `INSERT INTO rack_levels
       (rack_id, level_code, level_number, max_bins, max_weight_kg, height_cm, level_priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING rack_level_id`,
    [rackId, levelCode, levelNumber, BINS_PER_LEVEL, 500, 180, priority]
  );
  stats.levels.inserted++;
  return { rackLevelId: result.rows[0].rack_level_id, isNew: true };
}

async function upsertBin(rackLevelId, rackCode, levelNumber, binIndex) {
  const binCode = `B-${rackCode.replace(/^R-/, '')}-L${levelNumber}-${String(
    binIndex
  ).padStart(2, '0')}`;
  const existing = await pool.query(
    'SELECT bin_id FROM bins WHERE rack_level_id = $1 AND bin_code = $2',
    [rackLevelId, binCode]
  );
  if (existing.rows.length > 0) {
    stats.bins.skipped++;
    return existing.rows[0].bin_id;
  }

  const boxType = BOX_TYPES[(binIndex - 1) % BOX_TYPES.length];
  const result = await pool.query(
    `INSERT INTO bins
       (rack_level_id, bin_code, supported_box_type,
        max_lpn_count, max_volume_units, max_owner_count,
        reservation_type, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'SHARED', 'EMPTY')
     RETURNING bin_id`,
    [rackLevelId, binCode, boxType, 4, 16, 3]
  );
  stats.bins.inserted++;
  return result.rows[0].bin_id;
}

try {
  for (const wh of WAREHOUSES) {
    const warehouseId = await ensureWarehouse(wh);

    for (const zone of wh.zones) {
      const zoneId = await upsertZone(warehouseId, zone);
      for (const rack of zone.racks) {
        const { rackId } = await upsertRack(zoneId, rack);

        for (let lvl = 1; lvl <= rack.maxLevels; lvl++) {
          const { rackLevelId } = await upsertRackLevel(rackId, rack.rackCode, lvl, lvl);

          for (let b = 1; b <= BINS_PER_LEVEL; b++) {
            await upsertBin(rackLevelId, rack.rackCode, lvl, b);
          }
        }
      }
    }
  }

  console.log('\nSeed warehouse done:');
  console.log(
    `  Warehouses: +${stats.warehouses.inserted} / skipped ${stats.warehouses.skipped}`
  );
  console.log(`  Zones     : +${stats.zones.inserted} / skipped ${stats.zones.skipped}`);
  console.log(`  Racks     : +${stats.racks.inserted} / skipped ${stats.racks.skipped}`);
  console.log(`  Levels    : +${stats.levels.inserted} / skipped ${stats.levels.skipped}`);
  console.log(`  Bins      : +${stats.bins.inserted} / skipped ${stats.bins.skipped}`);
} catch (err) {
  console.error('Seed warehouse failed:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
