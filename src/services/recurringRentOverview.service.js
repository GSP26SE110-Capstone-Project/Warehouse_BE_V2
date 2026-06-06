import pool from '../config/db.js';
import Contract from '../models/Contract.js';
import {
  deriveMonthlyRent,
  daysBetweenCalendarDates,
  getBillingDayOfMonth,
  getNextBillingDateIso,
  formatDateVi,
} from '../utils/contractBilling.js';
import { toIsoDateOnly } from '../utils/rentalEffectiveDates.js';
import { INVOICE_PAYMENT_DUE_DAYS } from '../constants/pricingDefaults.js';

export const RECURRING_RENT_REMINDER_DAYS = 3;

async function loadPendingRecurringByContract(tenantId) {
  const { rows } = await pool.query(
    `SELECT invoice_id, contract_id, invoice_code, total_amount, payment_status,
            due_date, issued_at, billing_start_date, billing_end_date
     FROM invoices
     WHERE tenant_id = $1
       AND invoice_category = 'RECURRING_RENT'
       AND payment_status = 'PENDING'
     ORDER BY issued_at DESC`,
    [tenantId]
  );
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.contract_id)) {
      map.set(row.contract_id, {
        invoiceId: row.invoice_id,
        invoiceCode: row.invoice_code,
        totalAmount: Number(row.total_amount) || 0,
        paymentStatus: row.payment_status,
        dueDate: row.due_date,
        issuedAt: row.issued_at,
        billingStartDate: row.billing_start_date,
        billingEndDate: row.billing_end_date,
      });
    }
  }
  return map;
}

function resolvePaymentStatus({ daysUntil, pendingInvoice }) {
  if (pendingInvoice) return 'PENDING_INVOICE';
  if (daysUntil === null) return 'UNKNOWN';
  if (daysUntil <= RECURRING_RENT_REMINDER_DAYS) return 'DUE_SOON';
  return 'UPCOMING';
}

export function buildRecurringRentRow(contract, asOf = new Date(), pendingInvoice = null) {
  const nextBillingIso = getNextBillingDateIso(contract, asOf);
  const refIso = toIsoDateOnly(asOf);
  const daysUntil =
    nextBillingIso && refIso
      ? daysBetweenCalendarDates(refIso, nextBillingIso)
      : null;

  return {
    contractId: contract.contractId,
    contractCode: contract.contractCode,
    contractName: contract.contractName ?? null,
    warehouseId: contract.warehouseId,
    startDate: contract.startDate,
    endDate: contract.endDate,
    monthlyRent: deriveMonthlyRent(contract),
    billingDayOfMonth: getBillingDayOfMonth(contract),
    nextBillingDate: nextBillingIso,
    nextBillingDateLabel: nextBillingIso ? formatDateVi(nextBillingIso) : null,
    daysUntilNextBilling: daysUntil,
    reminderDays: RECURRING_RENT_REMINDER_DAYS,
    paymentDueDays: INVOICE_PAYMENT_DUE_DAYS,
    paymentStatus: resolvePaymentStatus({ daysUntil, pendingInvoice }),
    pendingInvoice: pendingInvoice ?? null,
  };
}

export async function listTenantRecurringRentOverview(tenantId, asOf = new Date()) {
  const contracts = await Contract.findAll(
    { tenantId, status: 'ACTIVE', billingCycle: 'MONTHLY' },
    { orderBy: 'start_date ASC' }
  );

  const pendingMap = await loadPendingRecurringByContract(tenantId);

  const { rows: warehouseRows } = await pool.query(
    `SELECT warehouse_id, warehouse_name, warehouse_code
     FROM warehouses
     WHERE warehouse_id = ANY($1::uuid[])`,
    [contracts.length ? contracts.map((c) => c.warehouseId) : ['00000000-0000-0000-0000-000000000000']]
  );
  const warehouseById = new Map(
    warehouseRows.map((w) => [
      w.warehouse_id,
      { warehouseName: w.warehouse_name, warehouseCode: w.warehouse_code },
    ])
  );

  const items = contracts.map((contract) => {
    const pending = pendingMap.get(contract.contractId) ?? null;
    const row = buildRecurringRentRow(contract, asOf, pending);
    const wh = warehouseById.get(contract.warehouseId);
    return {
      ...row,
      warehouseName: wh?.warehouseName ?? null,
      warehouseCode: wh?.warehouseCode ?? null,
    };
  });

  const dueSoonCount = items.filter((i) => i.paymentStatus === 'DUE_SOON').length;
  const pendingInvoiceCount = items.filter((i) => i.pendingInvoice).length;

  return {
    reminderDays: RECURRING_RENT_REMINDER_DAYS,
    dueSoonCount,
    pendingInvoiceCount,
    items,
  };
}
