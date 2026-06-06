import pool from '../config/db.js';
import { getWarehouseById } from './warehouse.service.js';

/** Rental từ guest onboarding — tenant chưa có TENANT_ADMIN. */
export async function getSystemAdminGuestAccountAlerts() {
  const countResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE rr.status IN ('PENDING', 'UNDER_REVIEW'))::int AS pending_guest_count,
       COUNT(*) FILTER (WHERE rr.status IN ('APPROVED', 'CONVERTED'))::int AS approved_awaiting_account_count,
       COUNT(*)::int AS guest_without_account_count
     FROM rental_requests rr
     WHERE NOT EXISTS (
       SELECT 1
       FROM users u
       WHERE u.tenant_id = rr.tenant_id
         AND u.role = 'TENANT_ADMIN'
     )
       AND rr.status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'CONVERTED')`
  );

  const recentResult = await pool.query(
    `SELECT
       rr.rental_request_id,
       rr.request_code,
       rr.status,
       rr.city,
       rr.district,
       rr.created_at,
       tc.company_name,
       tc.contact_email
     FROM rental_requests rr
     INNER JOIN tenant_companies tc ON tc.tenant_id = rr.tenant_id
     WHERE NOT EXISTS (
       SELECT 1
       FROM users u
       WHERE u.tenant_id = rr.tenant_id
         AND u.role = 'TENANT_ADMIN'
     )
       AND rr.status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'CONVERTED')
     ORDER BY rr.created_at DESC
     LIMIT 8`
  );

  const counts = countResult.rows[0] ?? {};

  return {
    pendingGuestCount: Number(counts.pending_guest_count) || 0,
    approvedAwaitingAccountCount: Number(counts.approved_awaiting_account_count) || 0,
    guestWithoutAccountCount: Number(counts.guest_without_account_count) || 0,
    recent: recentResult.rows.map((row) => ({
      rentalRequestId: row.rental_request_id,
      requestCode: row.request_code,
      status: row.status,
      city: row.city,
      district: row.district,
      companyName: row.company_name,
      contactEmail: row.contact_email,
      createdAt: row.created_at,
    })),
  };
}

/** Yêu cầu thuê chưa duyệt trong vùng kho WH_ADMIN (chưa claim). */
export async function getWarehouseAdminPendingRentalAlerts(user) {
  if (user?.role !== 'WH_ADMIN' || !user.warehouseId) {
    return {
      pendingCount: 0,
      warehouseName: null,
      city: null,
      district: null,
      recent: [],
    };
  }

  const warehouse = await getWarehouseById(user.warehouseId);
  const city = warehouse.city?.trim();
  const district = warehouse.district?.trim();

  if (!city || !district) {
    return {
      pendingCount: 0,
      warehouseName: warehouse.warehouseName ?? null,
      city: city ?? null,
      district: district ?? null,
      recent: [],
    };
  }

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS pending_count
     FROM rental_requests rr
     WHERE rr.warehouse_id IS NULL
       AND rr.status IN ('PENDING', 'UNDER_REVIEW')
       AND LOWER(TRIM(rr.city)) = LOWER(TRIM($1))
       AND LOWER(TRIM(rr.district)) = LOWER(TRIM($2))`,
    [city, district]
  );

  const recentResult = await pool.query(
    `SELECT
       rr.rental_request_id,
       rr.request_code,
       rr.status,
       rr.city,
       rr.district,
       rr.created_at,
       tc.company_name,
       tc.contact_email
     FROM rental_requests rr
     INNER JOIN tenant_companies tc ON tc.tenant_id = rr.tenant_id
     WHERE rr.warehouse_id IS NULL
       AND rr.status IN ('PENDING', 'UNDER_REVIEW')
       AND LOWER(TRIM(rr.city)) = LOWER(TRIM($1))
       AND LOWER(TRIM(rr.district)) = LOWER(TRIM($2))
     ORDER BY rr.created_at DESC
     LIMIT 8`,
    [city, district]
  );

  return {
    pendingCount: Number(countResult.rows[0]?.pending_count) || 0,
    warehouseName: warehouse.warehouseName ?? null,
    city,
    district,
    recent: recentResult.rows.map((row) => ({
      rentalRequestId: row.rental_request_id,
      requestCode: row.request_code,
      status: row.status,
      city: row.city,
      district: row.district,
      companyName: row.company_name,
      contactEmail: row.contact_email,
      createdAt: row.created_at,
    })),
  };
}

/** Inbound PENDING chờ WH Admin duyệt trong kho được gán. */
export async function getWarehouseAdminPendingInboundAlerts(user) {
  if (user?.role !== 'WH_ADMIN' || !user.warehouseId) {
    return {
      pendingCount: 0,
      warehouseName: null,
      recent: [],
    };
  }

  const warehouse = await getWarehouseById(user.warehouseId);
  const warehouseId = user.warehouseId;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS pending_count
     FROM inbound_requests ir
     WHERE ir.warehouse_id = $1
       AND ir.status = 'PENDING'`,
    [warehouseId]
  );

  const recentResult = await pool.query(
    `SELECT
       ir.inbound_request_id,
       ir.inbound_code,
       ir.status,
       ir.expected_arrival_date,
       ir.created_at,
       tc.company_name
     FROM inbound_requests ir
     INNER JOIN tenant_companies tc ON tc.tenant_id = ir.tenant_id
     WHERE ir.warehouse_id = $1
       AND ir.status = 'PENDING'
     ORDER BY ir.created_at DESC
     LIMIT 8`,
    [warehouseId]
  );

  return {
    pendingCount: Number(countResult.rows[0]?.pending_count) || 0,
    warehouseName: warehouse.warehouseName ?? null,
    recent: recentResult.rows.map((row) => ({
      inboundRequestId: row.inbound_request_id,
      inboundCode: row.inbound_code,
      status: row.status,
      expectedArrivalDate: row.expected_arrival_date,
      companyName: row.company_name,
      createdAt: row.created_at,
    })),
  };
}

/** HĐ vừa ACTIVE sau tenant thanh toán invoice INITIAL (PayOS / mark-paid). */
export async function getWarehouseAdminContractPaymentAlerts(user) {
  if (user?.role !== 'WH_ADMIN' || !user.warehouseId) {
    return {
      recentCount: 0,
      warehouseName: null,
      recent: [],
    };
  }

  const warehouse = await getWarehouseById(user.warehouseId);
  const warehouseId = user.warehouseId;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS recent_count
     FROM contracts c
     INNER JOIN invoices i
       ON i.contract_id = c.contract_id
       AND i.invoice_category = 'INITIAL'
       AND i.payment_status = 'PAID'
     LEFT JOIN LATERAL (
       SELECT p.paid_at
       FROM payments p
       WHERE p.invoice_id = i.invoice_id
         AND p.payment_status = 'SUCCESS'
       ORDER BY p.paid_at DESC NULLS LAST
       LIMIT 1
     ) pay ON TRUE
     WHERE c.warehouse_id = $1
       AND c.status = 'ACTIVE'
       AND COALESCE(pay.paid_at, i.updated_at, c.updated_at) >= NOW() - INTERVAL '48 hours'`,
    [warehouseId]
  );

  const recentResult = await pool.query(
    `SELECT
       c.contract_id,
       c.contract_code,
       c.contract_name,
       tc.company_name,
       i.invoice_code,
       i.total_amount,
       COALESCE(pay.paid_at, i.updated_at, c.updated_at) AS paid_at
     FROM contracts c
     INNER JOIN invoices i
       ON i.contract_id = c.contract_id
       AND i.invoice_category = 'INITIAL'
       AND i.payment_status = 'PAID'
     INNER JOIN tenant_companies tc ON tc.tenant_id = c.tenant_id
     LEFT JOIN LATERAL (
       SELECT p.paid_at
       FROM payments p
       WHERE p.invoice_id = i.invoice_id
         AND p.payment_status = 'SUCCESS'
       ORDER BY p.paid_at DESC NULLS LAST
       LIMIT 1
     ) pay ON TRUE
     WHERE c.warehouse_id = $1
       AND c.status = 'ACTIVE'
       AND COALESCE(pay.paid_at, i.updated_at, c.updated_at) >= NOW() - INTERVAL '7 days'
     ORDER BY COALESCE(pay.paid_at, i.updated_at, c.updated_at) DESC
     LIMIT 8`,
    [warehouseId]
  );

  return {
    recentCount: Number(countResult.rows[0]?.recent_count) || 0,
    warehouseName: warehouse.warehouseName ?? null,
    recent: recentResult.rows.map((row) => ({
      contractId: row.contract_id,
      contractCode: row.contract_code,
      contractName: row.contract_name,
      companyName: row.company_name,
      invoiceCode: row.invoice_code,
      totalAmount: Number(row.total_amount) || 0,
      paidAt: row.paid_at,
    })),
  };
}

/** Chuyến vận chuyển được gán cho WH_TRANSPORTER — chờ thực hiện. */
export async function getTransporterAssignedTripAlerts(user) {
  if (user?.role !== 'WH_TRANSPORTER' || !user.userId) {
    return {
      assignedCount: 0,
      recent: [],
    };
  }

  const countResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE ir.status = 'APPROVED')::int AS assigned_count,
       COUNT(*) FILTER (WHERE ir.status = 'IN_TRANSIT')::int AS in_transit_count
     FROM inbound_deliveries id
     INNER JOIN inbound_requests ir ON ir.inbound_request_id = id.inbound_request_id
     WHERE id.assigned_driver_user_id = $1
       AND ir.delivery_mode = 'WAREHOUSE_TRANSPORT'
       AND ir.status IN ('APPROVED', 'IN_TRANSIT')`,
    [user.userId]
  );

  const recentResult = await pool.query(
    `SELECT
       ir.inbound_request_id,
       ir.inbound_code,
       ir.status,
       ir.expected_arrival_date,
       id.vehicle_plate,
       id.updated_at AS assigned_at,
       tc.company_name
     FROM inbound_deliveries id
     INNER JOIN inbound_requests ir ON ir.inbound_request_id = id.inbound_request_id
     INNER JOIN tenant_companies tc ON tc.tenant_id = ir.tenant_id
     WHERE id.assigned_driver_user_id = $1
       AND ir.delivery_mode = 'WAREHOUSE_TRANSPORT'
       AND ir.status IN ('APPROVED', 'IN_TRANSIT', 'ARRIVED', 'RECEIVING')
     ORDER BY id.updated_at DESC
     LIMIT 10`,
    [user.userId]
  );

  return {
    assignedCount: Number(countResult.rows[0]?.assigned_count) || 0,
    inTransitCount: Number(countResult.rows[0]?.in_transit_count) || 0,
    recent: recentResult.rows.map((row) => ({
      inboundRequestId: row.inbound_request_id,
      inboundCode: row.inbound_code,
      status: row.status,
      expectedArrivalDate: row.expected_arrival_date,
      vehiclePlate: row.vehicle_plate,
      companyName: row.company_name,
      assignedAt: row.assigned_at,
    })),
  };
}

/** Phiếu xuất được gán cho WH_STAFF — cần pick. */
export async function getWhStaffAssignedPickAlerts(user) {
  if (user?.role !== 'WH_STAFF' || !user.userId) {
    return {
      assignedCount: 0,
      pickingCount: 0,
      recent: [],
    };
  }

  const countResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE o.status = 'RESERVED')::int AS assigned_count,
       COUNT(*) FILTER (WHERE o.status = 'PICKING')::int AS picking_count
     FROM picking_tasks pt
     INNER JOIN outbound_requests o ON o.outbound_request_id = pt.outbound_request_id
     WHERE pt.assigned_to = $1
       AND o.status IN ('RESERVED', 'PICKING')`,
    [user.userId]
  );

  const recentResult = await pool.query(
    `SELECT
       o.outbound_request_id,
       o.outbound_code,
       o.status,
       o.requested_ship_date,
       pt.updated_at AS assigned_at,
       tc.company_name
     FROM picking_tasks pt
     INNER JOIN outbound_requests o ON o.outbound_request_id = pt.outbound_request_id
     INNER JOIN tenant_companies tc ON tc.tenant_id = o.tenant_id
     WHERE pt.assigned_to = $1
       AND o.status IN ('RESERVED', 'PICKING', 'PACKING')
     ORDER BY pt.updated_at DESC
     LIMIT 10`,
    [user.userId]
  );

  return {
    assignedCount: Number(countResult.rows[0]?.assigned_count) || 0,
    pickingCount: Number(countResult.rows[0]?.picking_count) || 0,
    recent: recentResult.rows.map((row) => ({
      outboundRequestId: row.outbound_request_id,
      outboundCode: row.outbound_code,
      status: row.status,
      requestedShipDate: row.requested_ship_date,
      companyName: row.company_name,
      assignedAt: row.assigned_at,
    })),
  };
}

/** Tenant admin — inbound kho đi lấy đã gán tài xế hoặc đã tới kho. */
export async function getTenantInboundTransportAlerts(user) {
  if (user?.role !== 'TENANT_ADMIN' || !user.tenantId) {
    return { assignedCount: 0, inTransitCount: 0, arrivedCount: 0, recent: [] };
  }

  const countResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE ir.status = 'APPROVED'
           AND id.assigned_driver_user_id IS NOT NULL
       )::int AS assigned_count,
       COUNT(*) FILTER (WHERE ir.status = 'IN_TRANSIT')::int AS in_transit_count,
       COUNT(*) FILTER (WHERE ir.status = 'ARRIVED')::int AS arrived_count
     FROM inbound_deliveries id
     INNER JOIN inbound_requests ir ON ir.inbound_request_id = id.inbound_request_id
     WHERE ir.tenant_id = $1
       AND ir.delivery_mode = 'WAREHOUSE_TRANSPORT'
       AND id.assigned_driver_user_id IS NOT NULL
       AND ir.status IN ('APPROVED', 'IN_TRANSIT', 'ARRIVED', 'RECEIVING')`,
    [user.tenantId]
  );

  const recentResult = await pool.query(
    `SELECT
       ir.inbound_request_id,
       ir.inbound_code,
       ir.status,
       ir.expected_arrival_date,
       ir.actual_arrival_at,
       id.driver_name,
       id.vehicle_plate,
       id.updated_at AS assigned_at
     FROM inbound_deliveries id
     INNER JOIN inbound_requests ir ON ir.inbound_request_id = id.inbound_request_id
     WHERE ir.tenant_id = $1
       AND ir.delivery_mode = 'WAREHOUSE_TRANSPORT'
       AND id.assigned_driver_user_id IS NOT NULL
     ORDER BY
       CASE
         WHEN ir.status = 'ARRIVED' THEN 0
         WHEN ir.status = 'IN_TRANSIT' THEN 1
         ELSE 2
       END,
       COALESCE(ir.actual_arrival_at, id.actual_pickup_at, id.updated_at) DESC
     LIMIT 10`,
    [user.tenantId]
  );

  const counts = countResult.rows[0] ?? {};

  return {
    assignedCount: Number(counts.assigned_count) || 0,
    inTransitCount: Number(counts.in_transit_count) || 0,
    arrivedCount: Number(counts.arrived_count) || 0,
    recent: recentResult.rows.map((row) => ({
      inboundRequestId: row.inbound_request_id,
      inboundCode: row.inbound_code,
      status: row.status,
      expectedArrivalDate: row.expected_arrival_date,
      actualArrivalAt: row.actual_arrival_at,
      driverName: row.driver_name,
      vehiclePlate: row.vehicle_plate,
      assignedAt: row.assigned_at,
    })),
  };
}

/** Phụ lục HĐ chờ WH Admin duyệt trong kho được gán. */
export async function getWarehouseAdminPendingAppendixAlerts(user) {
  if (user?.role !== 'WH_ADMIN' || !user.warehouseId) {
    return {
      pendingCount: 0,
      warehouseName: null,
      recent: [],
    };
  }

  const warehouse = await getWarehouseById(user.warehouseId);
  const warehouseId = user.warehouseId;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS pending_count
     FROM contract_appendices ca
     INNER JOIN contracts c ON c.contract_id = ca.contract_id
     WHERE c.warehouse_id = $1
       AND ca.status IN ('PENDING', 'UNDER_REVIEW')`,
    [warehouseId]
  );

  const recentResult = await pool.query(
    `SELECT
       ca.appendix_id,
       ca.appendix_code,
       ca.status,
       ca.title,
       ca.created_at,
       c.contract_id,
       c.contract_code,
       tc.company_name
     FROM contract_appendices ca
     INNER JOIN contracts c ON c.contract_id = ca.contract_id
     INNER JOIN tenant_companies tc ON tc.tenant_id = c.tenant_id
     WHERE c.warehouse_id = $1
       AND ca.status IN ('PENDING', 'UNDER_REVIEW')
     ORDER BY ca.created_at DESC
     LIMIT 8`,
    [warehouseId]
  );

  return {
    pendingCount: Number(countResult.rows[0]?.pending_count) || 0,
    warehouseName: warehouse.warehouseName ?? null,
    recent: recentResult.rows.map((row) => ({
      appendixId: row.appendix_id,
      appendixCode: row.appendix_code,
      status: row.status,
      title: row.title,
      contractId: row.contract_id,
      contractCode: row.contract_code,
      companyName: row.company_name,
      createdAt: row.created_at,
    })),
  };
}

/** WH Admin — inbound kho đi lấy: tài xế đã lấy hàng, đang về kho. */
export async function getWarehouseAdminInTransitInboundAlerts(user) {
  if (user?.role !== 'WH_ADMIN' || !user.warehouseId) {
    return { inTransitCount: 0, warehouseName: null, recent: [] };
  }

  const warehouse = await getWarehouseById(user.warehouseId);
  const warehouseId = user.warehouseId;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS in_transit_count
     FROM inbound_requests ir
     WHERE ir.warehouse_id = $1
       AND ir.delivery_mode = 'WAREHOUSE_TRANSPORT'
       AND ir.status = 'IN_TRANSIT'`,
    [warehouseId]
  );

  const recentResult = await pool.query(
    `SELECT
       ir.inbound_request_id,
       ir.inbound_code,
       ir.status,
       id.actual_pickup_at,
       id.vehicle_plate,
       id.driver_name,
       id.pickup_address,
       tc.company_name
     FROM inbound_requests ir
     LEFT JOIN inbound_deliveries id ON id.inbound_request_id = ir.inbound_request_id
     INNER JOIN tenant_companies tc ON tc.tenant_id = ir.tenant_id
     WHERE ir.warehouse_id = $1
       AND ir.delivery_mode = 'WAREHOUSE_TRANSPORT'
       AND ir.status = 'IN_TRANSIT'
     ORDER BY id.actual_pickup_at DESC NULLS LAST
     LIMIT 10`,
    [warehouseId]
  );

  return {
    inTransitCount: Number(countResult.rows[0]?.in_transit_count) || 0,
    warehouseName: warehouse.warehouseName ?? null,
    recent: recentResult.rows.map((row) => ({
      inboundRequestId: row.inbound_request_id,
      inboundCode: row.inbound_code,
      status: row.status,
      actualPickupAt: row.actual_pickup_at,
      vehiclePlate: row.vehicle_plate,
      driverName: row.driver_name,
      pickupAddress: row.pickup_address,
      companyName: row.company_name,
    })),
  };
}

/** WH Admin — inbound kho đi lấy đã tới cổng (chờ nhận hàng). */
export async function getWarehouseAdminArrivedInboundAlerts(user) {
  if (user?.role !== 'WH_ADMIN' || !user.warehouseId) {
    return { arrivedCount: 0, warehouseName: null, recent: [] };
  }

  const warehouse = await getWarehouseById(user.warehouseId);
  const warehouseId = user.warehouseId;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS arrived_count
     FROM inbound_requests ir
     WHERE ir.warehouse_id = $1
       AND ir.delivery_mode = 'WAREHOUSE_TRANSPORT'
       AND ir.status = 'ARRIVED'`,
    [warehouseId]
  );

  const recentResult = await pool.query(
    `SELECT
       ir.inbound_request_id,
       ir.inbound_code,
       ir.status,
       ir.actual_arrival_at,
       id.vehicle_plate,
       id.driver_name,
       tc.company_name
     FROM inbound_requests ir
     LEFT JOIN inbound_deliveries id ON id.inbound_request_id = ir.inbound_request_id
     INNER JOIN tenant_companies tc ON tc.tenant_id = ir.tenant_id
     WHERE ir.warehouse_id = $1
       AND ir.delivery_mode = 'WAREHOUSE_TRANSPORT'
       AND ir.status = 'ARRIVED'
     ORDER BY ir.actual_arrival_at DESC NULLS LAST
     LIMIT 10`,
    [warehouseId]
  );

  return {
    arrivedCount: Number(countResult.rows[0]?.arrived_count) || 0,
    warehouseName: warehouse.warehouseName ?? null,
    recent: recentResult.rows.map((row) => ({
      inboundRequestId: row.inbound_request_id,
      inboundCode: row.inbound_code,
      status: row.status,
      actualArrivalAt: row.actual_arrival_at,
      vehiclePlate: row.vehicle_plate,
      driverName: row.driver_name,
      companyName: row.company_name,
    })),
  };
}
