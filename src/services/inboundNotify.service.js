import pool from '../config/db.js';
import {
  sendInboundArrivalTenantEmail,
  sendInboundArrivalWhAdminEmail,
  sendInboundTransportAssignedEmail,
} from '../config/mail.js';
import {
  buildTenantInboundUrl,
  buildWhAdminInboundUrl,
} from '../utils/appUrl.js';
import { getTenantCompany } from './tenantCompany.service.js';
import { getWarehouseById } from './warehouse.service.js';
import User from '../models/User.js';

async function findActiveTenantAdmin(tenantId) {
  const result = await pool.query(
    `SELECT user_id, full_name, email
     FROM users
     WHERE tenant_id = $1
       AND role = 'TENANT_ADMIN'::role_enum
       AND status = 'ACTIVE'::user_status_enum
     LIMIT 1`,
    [tenantId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
  };
}

async function findActiveWhAdmin(warehouseId) {
  const result = await pool.query(
    `SELECT user_id, full_name, email
     FROM users
     WHERE warehouse_id = $1
       AND role = 'WH_ADMIN'::role_enum
       AND status = 'ACTIVE'::user_status_enum
     LIMIT 1`,
    [warehouseId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
  };
}

function formatDateVi(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN');
}

/**
 * Thông báo tenant admin khi kho gán tài xế / lưu thông tin vận chuyển inbound.
 * Không chặn luồng chính nếu gửi email thất bại.
 */
export async function notifyTenantAdminTransportAssigned({
  inbound,
  delivery,
  previousAssignedDriverUserId = null,
}) {
  if (inbound?.deliveryMode !== 'WAREHOUSE_TRANSPORT') {
    return { sent: false, reason: 'NOT_WAREHOUSE_TRANSPORT' };
  }

  const assignedId = delivery?.assignedDriverUserId ?? null;
  if (!assignedId) {
    return { sent: false, reason: 'NO_DRIVER_ASSIGNED' };
  }

  const admin = await findActiveTenantAdmin(inbound.tenantId);
  if (!admin?.email) {
    return { sent: false, reason: 'NO_TENANT_ADMIN' };
  }

  const [tenant, warehouse, driver] = await Promise.all([
    getTenantCompany(inbound.tenantId),
    getWarehouseById(inbound.warehouseId),
    User.findById(assignedId),
  ]);

  try {
    await sendInboundTransportAssignedEmail({
      to: admin.email,
      tenantAdminName: admin.fullName,
      inboundCode: inbound.inboundCode,
      expectedArrivalDate: formatDateVi(inbound.expectedArrivalDate),
      driverName: delivery.driverName ?? driver?.fullName ?? '—',
      driverPhone: delivery.driverPhone ?? driver?.phone ?? '—',
      vehiclePlate: delivery.vehiclePlate ?? '—',
      pickupAddress: delivery.pickupAddress ?? tenant.address ?? '—',
      pickupContactName: delivery.pickupContactName ?? tenant.contactName ?? '—',
      pickupContactPhone: delivery.pickupContactPhone ?? tenant.contactPhone ?? '—',
      warehouseName: warehouse.warehouseName,
      warehouseAddress: [warehouse.address, warehouse.district, warehouse.city]
        .filter(Boolean)
        .join(', '),
      inboundUrl: buildTenantInboundUrl(inbound.inboundRequestId),
    });
    return { sent: true, to: admin.email };
  } catch (err) {
    return {
      sent: false,
      to: admin.email,
      error: err.message || 'Failed to send notification email',
    };
  }
}

/**
 * Thông báo WH Admin + Tenant Admin khi tài xế báo xe đã đến kho.
 */
export async function notifyInboundArrivalReported({ inbound, delivery, actor }) {
  if (inbound?.deliveryMode !== 'WAREHOUSE_TRANSPORT') {
    return { whAdmin: { sent: false, reason: 'NOT_WAREHOUSE_TRANSPORT' }, tenantAdmin: { sent: false, reason: 'NOT_WAREHOUSE_TRANSPORT' } };
  }

  const actualArrivalAt = formatDateVi(inbound.actualArrivalAt ?? new Date());
  const [tenant, warehouse, driver, whAdmin, tenantAdmin] = await Promise.all([
    getTenantCompany(inbound.tenantId),
    getWarehouseById(inbound.warehouseId),
    delivery?.assignedDriverUserId ? User.findById(delivery.assignedDriverUserId) : Promise.resolve(null),
    findActiveWhAdmin(inbound.warehouseId),
    findActiveTenantAdmin(inbound.tenantId),
  ]);

  const driverName = delivery?.driverName ?? driver?.fullName ?? actor?.fullName ?? '—';
  const driverPhone = delivery?.driverPhone ?? driver?.phone ?? '—';
  const vehiclePlate = delivery?.vehiclePlate ?? '—';
  const warehouseAddress = [warehouse.address, warehouse.district, warehouse.city]
    .filter(Boolean)
    .join(', ');

  const results = { whAdmin: { sent: false }, tenantAdmin: { sent: false } };

  if (whAdmin?.email) {
    try {
      await sendInboundArrivalWhAdminEmail({
        to: whAdmin.email,
        whAdminName: whAdmin.fullName,
        inboundCode: inbound.inboundCode,
        actualArrivalAt,
        driverName,
        driverPhone,
        vehiclePlate,
        companyName: tenant.companyName ?? '—',
        warehouseName: warehouse.warehouseName,
        inboundUrl: buildWhAdminInboundUrl(inbound.inboundRequestId),
      });
      results.whAdmin = { sent: true, to: whAdmin.email };
    } catch (err) {
      results.whAdmin = { sent: false, to: whAdmin.email, error: err.message };
    }
  } else {
    results.whAdmin = { sent: false, reason: 'NO_WH_ADMIN' };
  }

  if (tenantAdmin?.email) {
    try {
      await sendInboundArrivalTenantEmail({
        to: tenantAdmin.email,
        tenantAdminName: tenantAdmin.fullName,
        inboundCode: inbound.inboundCode,
        actualArrivalAt,
        driverName,
        vehiclePlate,
        warehouseName: warehouse.warehouseName,
        warehouseAddress,
        inboundUrl: buildTenantInboundUrl(inbound.inboundRequestId),
      });
      results.tenantAdmin = { sent: true, to: tenantAdmin.email };
    } catch (err) {
      results.tenantAdmin = { sent: false, to: tenantAdmin.email, error: err.message };
    }
  } else {
    results.tenantAdmin = { sent: false, reason: 'NO_TENANT_ADMIN' };
  }

  return results;
}
