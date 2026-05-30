import pool from '../config/db.js';
import { sendContractSignedByTenantEmail } from '../config/mail.js';
import { buildAdminContractsUrl } from '../utils/appUrl.js';
import { getTenantCompany } from './tenantCompany.service.js';
import { getWarehouseById } from './warehouse.service.js';

async function findActiveWarehouseAdmin(warehouseId) {
  const result = await pool.query(
    `SELECT full_name, email
     FROM users
     WHERE warehouse_id = $1
       AND role = 'WH_ADMIN'::role_enum
       AND status = 'ACTIVE'::user_status_enum
     LIMIT 1`,
    [warehouseId]
  );
  return result.rows[0] ?? null;
}

function formatDateVi(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN');
}

/**
 * Gửi email cho WH Admin khi tenant ký xong hợp đồng (không chặn luồng chính).
 */
export async function notifyWarehouseAdminContractSigned(contract) {
  const admin = await findActiveWarehouseAdmin(contract.warehouseId);
  if (!admin?.email) {
    return { sent: false, reason: 'NO_WH_ADMIN' };
  }

  const [tenant, warehouse] = await Promise.all([
    getTenantCompany(contract.tenantId),
    getWarehouseById(contract.warehouseId),
  ]);

  try {
    await sendContractSignedByTenantEmail({
      to: admin.email,
      whAdminName: admin.full_name,
      tenantName: tenant.companyName,
      contractCode: contract.contractCode,
      contractName: contract.contractName,
      warehouseName: warehouse.warehouseName,
      warehouseCode: warehouse.warehouseCode,
      startDate: formatDateVi(contract.startDate),
      endDate: formatDateVi(contract.endDate),
      contractsUrl: buildAdminContractsUrl(),
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
