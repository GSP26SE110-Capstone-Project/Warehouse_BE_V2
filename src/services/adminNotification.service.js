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
