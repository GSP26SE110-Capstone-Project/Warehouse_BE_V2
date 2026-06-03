/**
 * Seed các bảng chưa có trong seed:accounts / warehouse / sku-lpn.
 * Catalog (garment_category_groups, product_kind_catalog, size_factor_catalog) do migration SQL seed.
 *
 * Usage: node scripts/seed-extended.mjs  (hoặc npm run seed:all)
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from '../src/config/db.js';

const TENANT_ID = '1fb376e8-b68a-4ffc-bdb5-de570ff2917d';
const WAREHOUSE_ID = '2084bdca-8320-439c-8e37-e0d37fa3d7c9';

const DEMO_CONTRACT_CODE = 'CTR-SEED-DEMO';
const DEMO_INBOUND_CODE = 'INB-SEED-DEMO';
const DEMO_RENTAL_CODE = 'RR-SEED-001';
const DEMO_BRANCH_CODE = 'BR-HCM-01';
const DEMO_OUTBOUND_CODE = 'OUT-SEED-DEMO';
const DEMO_INVOICE_CODE = 'INV-SEED-001';
const DEMO_SHIPMENT_CODE = 'SHP-SEED-001';

const EXTRA_USERS = [
  {
    label: 'WH_STAFF',
    role: 'WH_STAFF',
    email: 'whstaff@warehouse.local',
    password: 'WhStaff@12345',
    fullName: 'Nhân viên kho HCM',
    tenantId: null,
    warehouseId: WAREHOUSE_ID,
    vehiclePlate: null,
  },
  {
    label: 'WH_TRANSPORTER',
    role: 'WH_TRANSPORTER',
    email: 'transporter@warehouse.local',
    password: 'Transporter@12345',
    fullName: 'Tài xế kho HCM',
    tenantId: null,
    warehouseId: WAREHOUSE_ID,
    vehiclePlate: '51H-12345',
    driverId: '079123456789',
    carrierName: 'Smart Warehouse Transport',
  },
  {
    label: 'TENANT_STAFF',
    role: 'TENANT_STAFF',
    email: 'tenantstaff@brand.local',
    password: 'TenantStaff@12345',
    fullName: 'Nhân viên Brand A',
    tenantId: TENANT_ID,
    warehouseId: null,
    vehiclePlate: null,
  },
];

async function lookupUser(email) {
  const r = await pool.query('SELECT user_id, email, role FROM users WHERE email = $1', [
    email.toLowerCase(),
  ]);
  return r.rows[0] ?? null;
}

async function ensureExtraUsers() {
  for (const u of EXTRA_USERS) {
    const existing = await lookupUser(u.email);
    if (existing) {
      console.log(`[user =] ${u.label}:`, existing.email);
      if (u.role === 'WH_TRANSPORTER' && u.vehiclePlate) {
        await pool.query(
          `UPDATE users SET
             default_vehicle_plate = COALESCE(default_vehicle_plate, $2),
             default_driver_id_number = COALESCE(default_driver_id_number, $3),
             default_carrier_name = COALESCE(default_carrier_name, $4),
             updated_at = NOW()
           WHERE user_id = $1`,
          [existing.user_id, u.vehiclePlate, u.driverId, u.carrierName]
        );
      }
      continue;
    }
    const hash = await bcrypt.hash(u.password, 10);
    const r = await pool.query(
      `INSERT INTO users (
         tenant_id, warehouse_id, full_name, email, password_hash, role, status,
         default_vehicle_plate, default_driver_id_number, default_carrier_name
       ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $8, $9)
       RETURNING user_id, email, role`,
      [
        u.tenantId,
        u.warehouseId,
        u.fullName,
        u.email.toLowerCase(),
        hash,
        u.role,
        u.vehiclePlate,
        u.driverId ?? null,
        u.carrierName ?? null,
      ]
    );
    console.log(`[user +] ${u.label}:`, r.rows[0].email);
  }
}

async function ensureBranch() {
  const whAdmin = await lookupUser('whadmin@warehouse.local');
  const existing = await pool.query(
    'SELECT branch_id FROM branches WHERE branch_code = $1',
    [DEMO_BRANCH_CODE]
  );
  if (existing.rows.length > 0) {
    console.log('[branch =]', DEMO_BRANCH_CODE);
    return existing.rows[0].branch_id;
  }
  const r = await pool.query(
    `INSERT INTO branches (manager_id, branch_code, branch_name, city, is_active)
     VALUES ($1, $2, $3, $4, TRUE)
     RETURNING branch_id`,
    [whAdmin?.user_id ?? null, DEMO_BRANCH_CODE, 'Chi nhánh HCM Trung tâm', 'TP.HCM']
  );
  console.log('[branch +]', DEMO_BRANCH_CODE);
  return r.rows[0].branch_id;
}

async function resolveContractId() {
  const r = await pool.query(
    'SELECT contract_id FROM contracts WHERE contract_code = $1',
    [DEMO_CONTRACT_CODE]
  );
  if (r.rows.length === 0) {
    throw new Error(`Contract ${DEMO_CONTRACT_CODE} not found. Run seed:sku-lpn first.`);
  }
  return r.rows[0].contract_id;
}

async function resolveInboundId() {
  const r = await pool.query(
    'SELECT inbound_request_id FROM inbound_requests WHERE inbound_code = $1',
    [DEMO_INBOUND_CODE]
  );
  if (r.rows.length === 0) {
    throw new Error(`Inbound ${DEMO_INBOUND_CODE} not found.`);
  }
  return r.rows[0].inbound_request_id;
}

async function pickFirstBin(warehouseId) {
  const r = await pool.query(
    `SELECT b.bin_id, b.bin_code, rl.rack_level_id, r.rack_id, z.zone_id
     FROM bins b
     JOIN rack_levels rl ON b.rack_level_id = rl.rack_level_id
     JOIN racks r ON rl.rack_id = r.rack_id
     JOIN warehouse_zones z ON r.zone_id = z.zone_id
     WHERE z.warehouse_id = $1
     ORDER BY b.bin_code
     LIMIT 1`,
    [warehouseId]
  );
  if (r.rows.length === 0) {
    throw new Error('No bins found. Run seed:warehouse first.');
  }
  return r.rows[0];
}

async function ensureRentalRequest() {
  const existing = await pool.query(
    'SELECT rental_request_id, status FROM rental_requests WHERE request_code = $1',
    [DEMO_RENTAL_CODE]
  );
  let rentalRequestId;
  if (existing.rows.length > 0) {
    rentalRequestId = existing.rows[0].rental_request_id;
    console.log('[rental =]', DEMO_RENTAL_CODE);
  } else {
    const r = await pool.query(
      `INSERT INTO rental_requests (
         request_code, tenant_id, city, district, warehouse_id,
         contract_type, pricing_model, billing_cycle,
         estimated_sku_count, estimated_box_count, requested_area_m2,
         status, notes
       ) VALUES (
         $1, $2, 'TP.HCM', 'Quận 7', $3,
         'SHARED_STORAGE', 'USAGE_BASED', 'MONTHLY',
         500, 120, 80,
         'APPROVED', 'Yêu cầu thuê kho seed demo'
       )
       RETURNING rental_request_id`,
      [DEMO_RENTAL_CODE, TENANT_ID, WAREHOUSE_ID]
    );
    rentalRequestId = r.rows[0].rental_request_id;
    console.log('[rental +]', DEMO_RENTAL_CODE);
  }

  const lineExists = await pool.query(
    'SELECT line_id FROM rental_request_product_lines WHERE rental_request_id = $1 LIMIT 1',
    [rentalRequestId]
  );
  if (lineExists.rows.length === 0) {
    await pool.query(
      `INSERT INTO rental_request_product_lines (
         rental_request_id, product_kind, size, size_group, quantity,
         base_volume_units_per_piece, size_factor, final_volume_units_per_piece,
         line_volume_units, sort_order
       ) VALUES ($1, 'T_SHIRT', 'M', 'M_L', 200, 0.5, 1.0, 0.5, 100, 1)`,
      [rentalRequestId]
    );
    await pool.query(
      `INSERT INTO rental_request_product_lines (
         rental_request_id, product_kind, size, size_group, quantity,
         base_volume_units_per_piece, size_factor, final_volume_units_per_piece,
         line_volume_units, sort_order
       ) VALUES ($1, 'JEANS', '32', 'M_L', 80, 1.0, 1.0, 1.0, 80, 2)`,
      [rentalRequestId]
    );
    console.log('[rental lines +] 2 rows');
  } else {
    console.log('[rental lines =] already seeded');
  }

  await pool.query(
    `UPDATE rental_requests
     SET total_committed_volume_units = 180, updated_at = NOW()
     WHERE rental_request_id = $1`,
    [rentalRequestId]
  );

  const contractId = await resolveContractId();
  await pool.query(
    `UPDATE contracts SET rental_request_id = $2, updated_at = NOW()
     WHERE contract_id = $1 AND rental_request_id IS DISTINCT FROM $2`,
    [contractId, rentalRequestId]
  );

  return { rentalRequestId, contractId };
}

async function ensureContractItems(contractId) {
  const existing = await pool.query(
    'SELECT contract_item_id FROM contract_items WHERE contract_id = $1 LIMIT 1',
    [contractId]
  );
  if (existing.rows.length > 0) {
    console.log('[contract_items =]');
    return;
  }
  await pool.query(
    `INSERT INTO contract_items (
       contract_id, item_type, storage_level, billing_unit, quantity, unit_price
     ) VALUES ($1, 'STORAGE', 'BIN', 'BIN_DAY', 10, 50000)`,
    [contractId]
  );
  await pool.query(
    `INSERT INTO contract_items (
       contract_id, item_type, billing_unit, quantity, unit_price
     ) VALUES ($1, 'INBOUND', 'INBOUND_LPN', 100, 15000)`,
    [contractId]
  );
  console.log('[contract_items +] 2 rows');
}

async function ensureStorageReservation(contractId, binRow) {
  const existing = await pool.query(
    'SELECT reservation_id FROM storage_reservations WHERE contract_id = $1 LIMIT 1',
    [contractId]
  );
  if (existing.rows.length > 0) {
    console.log('[storage_reservations =]');
    return;
  }
  await pool.query(
    `INSERT INTO storage_reservations (
       contract_id, tenant_id, reservation_type, storage_level,
       warehouse_id, zone_id, rack_id, rack_level_id, bin_id,
       reserved_capacity, box_type, start_date, end_date, status
     ) VALUES (
       $1, $2, 'SHARED', 'BIN',
       $3, $4, $5, $6, $7,
       16, 'MEDIUM', CURRENT_DATE, CURRENT_DATE + INTERVAL '365 days', 'ACTIVE'
     )`,
    [
      contractId,
      TENANT_ID,
      WAREHOUSE_ID,
      binRow.zone_id,
      binRow.rack_id,
      binRow.rack_level_id,
      binRow.bin_id,
    ]
  );
  console.log('[storage_reservations +]');
}

async function ensurePricingPolicies() {
  const existing = await pool.query(
    `SELECT pricing_policy_id FROM pricing_policies
     WHERE warehouse_id = $1 AND contract_type = 'SHARED_STORAGE' AND billing_unit = 'BIN_DAY'
     LIMIT 1`,
    [WAREHOUSE_ID]
  );
  if (existing.rows.length > 0) {
    console.log('[pricing_policies =]');
    return;
  }
  await pool.query(
    `INSERT INTO pricing_policies (
       warehouse_id, contract_type, storage_level, billing_unit, box_type, price, effective_from
     ) VALUES ($1, 'SHARED_STORAGE', 'BIN', 'BIN_DAY', 'MEDIUM', 50000, NOW())`,
    [WAREHOUSE_ID]
  );
  console.log('[pricing_policies +]');
}

async function ensureInboundDelivery(inboundRequestId) {
  const existing = await pool.query(
    'SELECT inbound_delivery_id FROM inbound_deliveries WHERE inbound_request_id = $1',
    [inboundRequestId]
  );
  if (existing.rows.length > 0) {
    console.log('[inbound_deliveries =]');
    return existing.rows[0].inbound_delivery_id;
  }
  const transporter = await lookupUser('transporter@warehouse.local');
  const r = await pool.query(
    `INSERT INTO inbound_deliveries (
       inbound_request_id, tenant_id, vehicle_plate, driver_name, driver_phone,
       carrier_name, scheduled_at, pickup_address, pickup_contact_name, pickup_contact_phone,
       assigned_driver_user_id
     ) VALUES (
       $1, $2, '51H-99999', 'Nguyễn Văn Tài', '0909999888',
       'Brand A Logistics', NOW() + INTERVAL '1 day',
       '123 Nguyễn Huệ, Quận 1, TP.HCM', 'Tenant Admin A', '0901111111',
       $3
     )
     RETURNING inbound_delivery_id`,
    [inboundRequestId, TENANT_ID, transporter?.user_id ?? null]
  );
  console.log('[inbound_deliveries +]');
  return r.rows[0].inbound_delivery_id;
}

async function ensureInventories(binRow, whStaffId) {
  const details = await pool.query(
    `SELECT ld.lpn_detail_id, ld.lpn_id, ld.sku_id, ld.quantity,
            l.tenant_id, l.batch_id, l.lpn_code
     FROM lpn_details ld
     JOIN lpns l ON l.lpn_id = ld.lpn_id
     WHERE l.lpn_code LIKE 'SEED-LPN-%'
     ORDER BY l.lpn_code`
  );
  if (details.rows.length === 0) {
    console.log('[inventories skip] no SEED LPN details');
    return [];
  }

  const inventoryIds = [];
  for (const row of details.rows) {
    const exists = await pool.query(
      'SELECT inventory_id FROM inventories WHERE lpn_id = $1 AND sku_id = $2',
      [row.lpn_id, row.sku_id]
    );
    let inventoryId;
    if (exists.rows.length > 0) {
      inventoryId = exists.rows[0].inventory_id;
    } else {
      const ins = await pool.query(
        `INSERT INTO inventories (
           tenant_id, sku_id, batch_id, lpn_id, bin_id, quantity,
           reserved_quantity, available_quantity, status, received_at
         ) VALUES ($1, $2, $3, $4, $5, $6, 0, $6, 'AVAILABLE', NOW())
         RETURNING inventory_id`,
        [row.tenant_id, row.sku_id, row.batch_id, row.lpn_id, binRow.bin_id, row.quantity]
      );
      inventoryId = ins.rows[0].inventory_id;
      await pool.query(
        `INSERT INTO inventory_movements (
           inventory_id, movement_type, to_bin_id, quantity, moved_by, note
         ) VALUES ($1, 'PUTAWAY', $2, $3, $4, 'Seed putaway')`,
        [inventoryId, binRow.bin_id, row.quantity, whStaffId]
      );
    }
    inventoryIds.push({ inventoryId, ...row });
    await pool.query(
      `UPDATE lpns SET current_bin_id = $2, status = 'STORED', updated_at = NOW() WHERE lpn_id = $1`,
      [row.lpn_id, binRow.bin_id]
    );
  }
  console.log('[inventories] rows:', inventoryIds.length);
  return inventoryIds;
}

async function ensureInvoice(contractId) {
  const existing = await pool.query(
    'SELECT invoice_id FROM invoices WHERE invoice_code = $1',
    [DEMO_INVOICE_CODE]
  );
  let invoiceId;
  if (existing.rows.length > 0) {
    invoiceId = existing.rows[0].invoice_id;
    console.log('[invoice =]', DEMO_INVOICE_CODE);
  } else {
    const r = await pool.query(
      `INSERT INTO invoices (
         tenant_id, contract_id, invoice_code,
         billing_start_date, billing_end_date,
         subtotal, tax, total_amount, payment_status, issued_at, due_date,
         invoice_category
       ) VALUES (
         $1, $2, $3,
         CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
         5000000, 500000, 5500000, 'PENDING',
         NOW(), CURRENT_DATE + INTERVAL '14 days',
         'INITIAL'
       )
       RETURNING invoice_id`,
      [TENANT_ID, contractId, DEMO_INVOICE_CODE]
    );
    invoiceId = r.rows[0].invoice_id;
    console.log('[invoice +]', DEMO_INVOICE_CODE);
  }

  const itemExists = await pool.query(
    'SELECT invoice_item_id FROM invoice_items WHERE invoice_id = $1 LIMIT 1',
    [invoiceId]
  );
  if (itemExists.rows.length === 0) {
    await pool.query(
      `INSERT INTO invoice_items (
         invoice_id, item_type, description, quantity, unit_price, total_price
       ) VALUES ($1, 'STORAGE', 'Phí thuê kho tháng đầu (seed)', 1, 5000000, 5000000)`,
      [invoiceId]
    );
    console.log('[invoice_items +]');
  }

  const payExists = await pool.query(
    'SELECT payment_id FROM payments WHERE invoice_id = $1 LIMIT 1',
    [invoiceId]
  );
  if (payExists.rows.length === 0) {
    await pool.query(
      `INSERT INTO payments (invoice_id, amount, payment_method, payment_status, transaction_code)
       VALUES ($1, 5500000, 'BANK_TRANSFER', 'PENDING', 'PAY-SEED-001')`,
      [invoiceId]
    );
    console.log('[payments +]');
  } else {
    console.log('[payments =]');
  }

  return invoiceId;
}

async function ensureOutboundFlow(contractId, inventoryRows, binRow) {
  const existing = await pool.query(
    'SELECT outbound_request_id FROM outbound_requests WHERE outbound_code = $1',
    [DEMO_OUTBOUND_CODE]
  );
  let outboundId;
  if (existing.rows.length > 0) {
    outboundId = existing.rows[0].outbound_request_id;
    console.log('[outbound =]', DEMO_OUTBOUND_CODE);
  } else {
    const tenantAdmin = await lookupUser('tenant1admin@brand.local');
    const r = await pool.query(
      `INSERT INTO outbound_requests (
         tenant_id, contract_id, warehouse_id, outbound_code,
         requested_ship_date, status, created_by
       ) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '2 days', 'APPROVED', $5)
       RETURNING outbound_request_id`,
      [TENANT_ID, contractId, WAREHOUSE_ID, DEMO_OUTBOUND_CODE, tenantAdmin?.user_id ?? null]
    );
    outboundId = r.rows[0].outbound_request_id;
    console.log('[outbound +]', DEMO_OUTBOUND_CODE);
  }

  const firstInv = inventoryRows[0];
  if (!firstInv) return outboundId;

  const skuId = firstInv.sku_id;
  const itemExists = await pool.query(
    'SELECT outbound_request_item_id FROM outbound_request_items WHERE outbound_request_id = $1 AND sku_id = $2',
    [outboundId, skuId]
  );
  if (itemExists.rows.length === 0) {
    await pool.query(
      `INSERT INTO outbound_request_items (outbound_request_id, sku_id, requested_quantity, allocated_quantity)
       VALUES ($1, $2, 5, 5)`,
      [outboundId, skuId]
    );
    console.log('[outbound_request_items +]');
  }

  const taskExists = await pool.query(
    'SELECT picking_task_id FROM picking_tasks WHERE outbound_request_id = $1 LIMIT 1',
    [outboundId]
  );
  let pickingTaskId;
  if (taskExists.rows.length > 0) {
    pickingTaskId = taskExists.rows[0].picking_task_id;
  } else {
    const whStaff = await lookupUser('whstaff@warehouse.local');
    const t = await pool.query(
      `INSERT INTO picking_tasks (outbound_request_id, assigned_to, status)
       VALUES ($1, $2, 'PENDING')
       RETURNING picking_task_id`,
      [outboundId, whStaff?.user_id ?? null]
    );
    pickingTaskId = t.rows[0].picking_task_id;
    console.log('[picking_tasks +]');
  }

  const ptiExists = await pool.query(
    'SELECT picking_task_item_id FROM picking_task_items WHERE picking_task_id = $1 LIMIT 1',
    [pickingTaskId]
  );
  if (ptiExists.rows.length === 0) {
    await pool.query(
      `INSERT INTO picking_task_items (
         picking_task_id, inventory_id, lpn_id, bin_id, batch_id, quantity_to_pick
       ) VALUES ($1, $2, $3, $4, $5, 5)`,
      [
        pickingTaskId,
        firstInv.inventoryId,
        firstInv.lpn_id,
        binRow.bin_id,
        firstInv.batch_id,
      ]
    );
    console.log('[picking_task_items +]');
  }

  const shipExists = await pool.query(
    'SELECT shipment_id FROM shipments WHERE shipment_code = $1',
    [DEMO_SHIPMENT_CODE]
  );
  if (shipExists.rows.length === 0) {
    await pool.query(
      `INSERT INTO shipments (
         tenant_id, outbound_request_id, shipment_code, carrier_name,
         vehicle_plate, driver_name, status
       ) VALUES ($1, $2, $3, 'Giao hàng nhanh seed', '51H-88888', 'Tài xế outbound', 'READY')`,
      [TENANT_ID, outboundId, DEMO_SHIPMENT_CODE]
    );
    console.log('[shipments +]');
  } else {
    console.log('[shipments =]');
  }

  return outboundId;
}

async function ensureContractTerminationSample(contractId) {
  const existing = await pool.query(
    `SELECT termination_request_id FROM contract_termination_requests
     WHERE contract_id = $1 LIMIT 1`,
    [contractId]
  );
  if (existing.rows.length > 0) {
    console.log('[contract_termination_requests =]');
    return;
  }
  const tenantAdmin = await lookupUser('tenant1admin@brand.local');
  await pool.query(
    `INSERT INTO contract_termination_requests (
       contract_id, tenant_id, requested_by, status, billing_cycle,
       has_inbound, total_paid, monthly_rate, contract_months, used_months, unused_months,
       processing_fee, termination_fee, refund_amount, reason
     ) VALUES (
       $1, $2, $3, 'PENDING', 'MONTHLY',
       TRUE, 5500000, 5000000, 12, 2, 10,
       200000, 0, 0, 'Seed: yêu cầu chấm dứt HĐ demo (chưa duyệt)'
     )`,
    [contractId, TENANT_ID, tenantAdmin?.user_id ?? null]
  );
  console.log('[contract_termination_requests +]');
}

async function ensureAnalyticsSnapshots(contractId, binRow) {
  const usageExists = await pool.query(
    `SELECT snapshot_id FROM storage_usage_snapshots
     WHERE tenant_id = $1 AND contract_id = $2 AND snapshot_date = CURRENT_DATE
     LIMIT 1`,
    [TENANT_ID, contractId]
  );
  if (usageExists.rows.length === 0) {
    await pool.query(
      `INSERT INTO storage_usage_snapshots (
         tenant_id, contract_id, snapshot_date, storage_level, billing_unit,
         box_type, occupied_count, calculated_fee
       ) VALUES ($1, $2, CURRENT_DATE, 'BIN', 'BIN_DAY', 'MEDIUM', 3, 150000)`,
      [TENANT_ID, contractId]
    );
    console.log('[storage_usage_snapshots +]');
  } else {
    console.log('[storage_usage_snapshots =]');
  }

  const occExists = await pool.query(
    `SELECT occupancy_snapshot_id FROM occupancy_snapshots
     WHERE warehouse_id = $1 AND zone_id = $2 AND snapshot_date = CURRENT_DATE
     LIMIT 1`,
    [WAREHOUSE_ID, binRow.zone_id]
  );
  if (occExists.rows.length === 0) {
    await pool.query(
      `INSERT INTO occupancy_snapshots (warehouse_id, zone_id, occupancy_rate, available_capacity, snapshot_date)
       VALUES ($1, $2, 0.35, 100, CURRENT_DATE)`,
      [WAREHOUSE_ID, binRow.zone_id]
    );
    console.log('[occupancy_snapshots +]');
  } else {
    console.log('[occupancy_snapshots =]');
  }

  const sku = await pool.query(
    `SELECT sku_id FROM skus WHERE tenant_id = $1 AND sku_code = 'SEED-SKU-001'`,
    [TENANT_ID]
  );
  if (sku.rows.length > 0) {
    const anaExists = await pool.query(
      'SELECT analytics_id FROM sku_movement_analytics WHERE sku_id = $1 LIMIT 1',
      [sku.rows[0].sku_id]
    );
    if (anaExists.rows.length === 0) {
      await pool.query(
        `INSERT INTO sku_movement_analytics (
           sku_id, snapshot_date, inbound_qty, outbound_qty, picking_count,
           average_storage_days, turnover_score, movement_category
         ) VALUES ($1, CURRENT_DATE, 100, 20, 5, 14.5, 0.82, 'FAST')`,
        [sku.rows[0].sku_id]
      );
      console.log('[sku_movement_analytics +]');
    } else {
      console.log('[sku_movement_analytics =]');
    }
  }

  const inboundId = await resolveInboundId();
  const lpnSku = await pool.query(
    `SELECT l.lpn_id, ld.sku_id
     FROM lpns l
     JOIN lpn_details ld ON ld.lpn_id = l.lpn_id
     WHERE l.lpn_code = 'SEED-LPN-001'
     LIMIT 1`
  );
  if (lpnSku.rows.length > 0) {
    const aiExists = await pool.query(
      'SELECT recommendation_id FROM ai_slot_recommendations WHERE lpn_id = $1 LIMIT 1',
      [lpnSku.rows[0].lpn_id]
    );
    if (aiExists.rows.length === 0) {
      await pool.query(
        `INSERT INTO ai_slot_recommendations (
           inbound_request_id, lpn_id, sku_id, recommended_zone_id, recommended_bin_id,
           recommendation_score, reason, is_applied
         ) VALUES ($1, $2, $3, $4, $5, 0.92, 'Seed: gần khu fast-moving', FALSE)`,
        [
          inboundId,
          lpnSku.rows[0].lpn_id,
          lpnSku.rows[0].sku_id,
          binRow.zone_id,
          binRow.bin_id,
        ]
      );
      console.log('[ai_slot_recommendations +]');
    } else {
      console.log('[ai_slot_recommendations =]');
    }
  }
}

async function printCatalogCounts() {
  const tables = [
    'garment_category_groups',
    'product_kind_catalog',
    'size_factor_catalog',
    'cities',
    'districts',
  ];
  for (const t of tables) {
    const r = await pool.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
    console.log(`[catalog] ${t}:`, r.rows[0].c, 'rows');
  }
}

// --- run ---
try {
  console.log('=== seed-extended ===\n');

  await ensureExtraUsers();
  await ensureBranch();
  const binRow = await pickFirstBin(WAREHOUSE_ID);
  console.log('[bin]', binRow.bin_code, binRow.bin_id);

  const { contractId } = await ensureRentalRequest();
  await ensureContractItems(contractId);
  await ensureStorageReservation(contractId, binRow);
  await ensurePricingPolicies();

  const inboundId = await resolveInboundId();
  await ensureInboundDelivery(inboundId);

  const whStaff = await lookupUser('whstaff@warehouse.local');
  const inventoryRows = await ensureInventories(binRow, whStaff?.user_id ?? null);
  await ensureInvoice(contractId);
  await ensureContractTerminationSample(contractId);
  await ensureOutboundFlow(contractId, inventoryRows, binRow);
  await ensureAnalyticsSnapshots(contractId, binRow);
  await printCatalogCounts();

  console.log('\nExtended seed done.');
  console.log('Extra logins:');
  console.log('  WH_STAFF: whstaff@warehouse.local / WhStaff@12345');
  console.log('  WH_TRANSPORTER: transporter@warehouse.local / Transporter@12345');
  console.log('  TENANT_STAFF: tenantstaff@brand.local / TenantStaff@12345');
} catch (err) {
  console.error('seed-extended failed:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
