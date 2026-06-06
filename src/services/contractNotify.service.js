import pool from '../config/db.js';
import {
  sendContractInitialPaymentReceivedEmail,
  sendContractPendingApprovalEmail,
  sendContractSignedByTenantEmail,
} from '../config/mail.js';
import { buildAdminContractsUrl, buildTenantContractsUrl } from '../utils/appUrl.js';
import { getTenantCompany } from './tenantCompany.service.js';
import { getWarehouseById } from './warehouse.service.js';
import RentalRequest from '../models/RentalRequest.js';
import { contractBillingMonths } from '../utils/rentalPeriodPricing.js';
import { toIsoDateOnly } from '../utils/rentalEffectiveDates.js';

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

function formatDateTimeVi(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN');
}

function formatVnd(amount) {
  const n = Math.round(Number(amount) || 0);
  return `${n.toLocaleString('vi-VN')} đ`;
}

async function findActiveTenantAdmin(tenantId) {
  const result = await pool.query(
    `SELECT full_name, email
     FROM users
     WHERE tenant_id = $1
       AND role = 'TENANT_ADMIN'::role_enum
       AND status = 'ACTIVE'::user_status_enum
     LIMIT 1`,
    [tenantId]
  );
  return result.rows[0] ?? null;
}

function buildContractDatesShiftNote(contract, rentalRequest) {
  if (!rentalRequest?.expectedStartDate || !rentalRequest?.expectedEndDate) {
    return null;
  }
  const reqStart = toIsoDateOnly(rentalRequest.expectedStartDate);
  const reqEnd = toIsoDateOnly(rentalRequest.expectedEndDate);
  const contractStart = toIsoDateOnly(contract.startDate);
  const contractEnd = toIsoDateOnly(contract.endDate);
  if (!reqStart || !reqEnd || !contractStart || !contractEnd) return null;
  if (reqStart === contractStart && reqEnd === contractEnd) return null;

  const billingMonths = contractBillingMonths(
    rentalRequest.expectedStartDate,
    rentalRequest.expectedEndDate
  );
  return (
    `Thời hạn khách yêu cầu: ${formatDateVi(rentalRequest.expectedStartDate)} → ${formatDateVi(rentalRequest.expectedEndDate)}. ` +
    `HĐ áp dụng ${formatDateVi(contract.startDate)} → ${formatDateVi(contract.endDate)} ` +
    `(giữ ${billingMonths} tháng thuê).`
  );
}

/**
 * Tenant admin — HĐ chuyển PENDING_APPROVAL, chờ ký.
 */
export async function notifyTenantAdminContractPendingApproval(contract) {
  if (!contract?.tenantId || contract.status !== 'PENDING_APPROVAL') {
    return { sent: false, reason: 'INVALID_CONTRACT' };
  }

  const admin = await findActiveTenantAdmin(contract.tenantId);
  if (!admin?.email) {
    return { sent: false, reason: 'NO_TENANT_ADMIN' };
  }

  const [tenant, warehouse, rentalRequest] = await Promise.all([
    getTenantCompany(contract.tenantId),
    getWarehouseById(contract.warehouseId),
    contract.rentalRequestId
      ? RentalRequest.findById(contract.rentalRequestId)
      : Promise.resolve(null),
  ]);

  const datesShiftNote = buildContractDatesShiftNote(contract, rentalRequest);

  try {
    await sendContractPendingApprovalEmail({
      to: admin.email,
      tenantAdminName: admin.full_name,
      companyName: tenant.companyName,
      contractCode: contract.contractCode,
      contractName: contract.contractName,
      warehouseName: warehouse?.warehouseName,
      warehouseCode: warehouse?.warehouseCode,
      startDate: formatDateVi(contract.startDate),
      endDate: formatDateVi(contract.endDate),
      datesShiftNote,
      contractsUrl: buildTenantContractsUrl(),
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

/**
 * Gửi email WH Admin khi tenant thanh toán invoice INITIAL → HĐ ACTIVE.
 */
export async function notifyWarehouseAdminContractPaymentReceived({ contract, invoice }) {
  const admin = await findActiveWarehouseAdmin(contract.warehouseId);
  if (!admin?.email) {
    return { sent: false, reason: 'NO_WH_ADMIN' };
  }

  const [tenant, warehouse] = await Promise.all([
    getTenantCompany(contract.tenantId),
    getWarehouseById(contract.warehouseId),
  ]);

  try {
    await sendContractInitialPaymentReceivedEmail({
      to: admin.email,
      whAdminName: admin.full_name,
      tenantName: tenant.companyName,
      contractCode: contract.contractCode,
      contractName: contract.contractName,
      warehouseName: warehouse.warehouseName,
      warehouseCode: warehouse.warehouseCode,
      invoiceCode: invoice.invoiceCode,
      amountPaid: formatVnd(invoice.totalAmount),
      paidAt: formatDateTimeVi(new Date()),
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
