import pool from '../config/db.js';
import Invoice from '../models/Invoice.js';
import Contract from '../models/Contract.js';
import {
  deriveMonthlyRent,
  formatDateVi,
  getRecurringBillingPeriodIso,
  isContractBillingDayToday,
  isContractFirstBillingMonth,
} from '../utils/contractBilling.js';
import { computeInvoiceDueDate } from '../utils/invoiceDueDate.js';
import { toIsoDateOnly } from '../utils/rentalEffectiveDates.js';

function generateInvoiceCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000)
    .toString(36)
    .toUpperCase()
    .padStart(2, '0');
  return `INV-${ts}-${rand}`;
}

async function hasRecurringForPeriod(contractId, periodStart, periodEnd) {
  const { rows } = await pool.query(
    `SELECT 1 FROM invoices
     WHERE contract_id = $1
       AND invoice_category = 'RECURRING_RENT'
       AND billing_start_date = $2
       AND billing_end_date = $3
     LIMIT 1`,
    [contractId, periodStart, periodEnd]
  );
  return rows.length > 0;
}

export async function createRecurringRentInvoiceIfDue(contract, asOf = new Date()) {
  if (contract.status !== 'ACTIVE') return null;
  if ((contract.billingCycle ?? 'MONTHLY') !== 'MONTHLY') return null;
  if (!isContractBillingDayToday(contract, asOf)) return null;
  if (isContractFirstBillingMonth(contract, asOf)) return null;

  const endIso = toIsoDateOnly(contract.endDate);
  const todayIso = toIsoDateOnly(asOf);
  if (endIso && todayIso && todayIso > endIso) return null;

  const amount = deriveMonthlyRent(contract);
  if (amount <= 0) return null;

  const { periodStart, periodEnd } = getRecurringBillingPeriodIso(contract, asOf);
  if (!periodStart || !periodEnd) return null;

  const exists = await hasRecurringForPeriod(
    contract.contractId,
    periodStart,
    periodEnd
  );
  if (exists) return null;

  const issuedAt = new Date();
  const due = computeInvoiceDueDate(issuedAt);
  const periodLabel = `${formatDateVi(periodStart)} → ${formatDateVi(periodEnd)}`;

  const invoice = await Invoice.create({
    tenantId: contract.tenantId,
    contractId: contract.contractId,
    invoiceCode: generateInvoiceCode(),
    invoiceCategory: 'RECURRING_RENT',
    totalAmount: amount,
    paymentStatus: 'PENDING',
    issuedAt,
    dueDate: due,
    billingStartDate: periodStart,
    billingEndDate: periodEnd,
    notes: `Tiền thuê định kỳ ${periodLabel}`,
  });

  return invoice;
}

export async function runRecurringRentBillingJob(asOf = new Date()) {
  const contracts = await Contract.findAll(
    { status: 'ACTIVE', billingCycle: 'MONTHLY' },
    { orderBy: 'created_at ASC' }
  );

  const created = [];
  for (const contract of contracts) {
    try {
      const invoice = await createRecurringRentInvoiceIfDue(contract, asOf);
      if (invoice) created.push(invoice);
    } catch (err) {
      console.warn('[billing] recurring rent failed:', contract.contractId, err?.message);
    }
  }
  return created;
}
