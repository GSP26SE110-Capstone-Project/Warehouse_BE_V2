import pool from '../config/db.js';
import {
  sendRentalRequestApprovedEmail,
  sendRentalRequestRejectedEmail,
} from '../config/mail.js';
import { buildTenantRentalRequestsUrl } from '../utils/appUrl.js';
import { getTenantCompany } from './tenantCompany.service.js';
import { getWarehouseById } from './warehouse.service.js';

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

function formatDateVi(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN');
}

/**
 * Thông báo tenant admin khi WH Admin duyệt yêu cầu thuê.
 * Không chặn luồng chính nếu gửi email thất bại.
 */
export async function notifyTenantAdminRentalApproved(rental) {
  if (!rental?.tenantId || rental.status !== 'APPROVED') {
    return { sent: false, reason: 'INVALID_RENTAL' };
  }

  const admin = await findActiveTenantAdmin(rental.tenantId);
  if (!admin?.email) {
    return { sent: false, reason: 'NO_TENANT_ADMIN' };
  }

  const [tenant, warehouse] = await Promise.all([
    getTenantCompany(rental.tenantId),
    rental.warehouseId ? getWarehouseById(rental.warehouseId) : Promise.resolve(null),
  ]);

  try {
    await sendRentalRequestApprovedEmail({
      to: admin.email,
      tenantAdminName: admin.fullName,
      companyName: tenant.companyName,
      requestCode: rental.requestCode,
      warehouseName: warehouse?.warehouseName ?? '—',
      warehouseCode: warehouse?.warehouseCode ?? null,
      city: rental.city,
      district: rental.district,
      contractType: rental.contractType,
      reviewedAt: formatDateVi(rental.reviewedAt),
      rentalRequestsUrl: buildTenantRentalRequestsUrl(),
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
 * Thông báo tenant admin khi yêu cầu thuê bị từ chối.
 */
export async function notifyTenantAdminRentalRejected(rental) {
  if (!rental?.tenantId || rental.status !== 'REJECTED') {
    return { sent: false, reason: 'INVALID_RENTAL' };
  }

  const admin = await findActiveTenantAdmin(rental.tenantId);
  if (!admin?.email) {
    return { sent: false, reason: 'NO_TENANT_ADMIN' };
  }

  const tenant = await getTenantCompany(rental.tenantId);

  try {
    await sendRentalRequestRejectedEmail({
      to: admin.email,
      tenantAdminName: admin.fullName,
      companyName: tenant.companyName,
      requestCode: rental.requestCode,
      city: rental.city,
      district: rental.district,
      rejectionReason: rental.rejectionReason ?? rental.reviewNote ?? null,
      reviewedAt: formatDateVi(rental.reviewedAt),
      rentalRequestsUrl: buildTenantRentalRequestsUrl(),
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
