import pool from '../config/db.js';
import Contract from '../models/Contract.js';
import {
  deriveMonthlyRent,
  daysBetweenCalendarDates,
  getNextBillingDateIso,
  formatDateVi,
} from '../utils/contractBilling.js';
import { toIsoDateOnly } from '../utils/rentalEffectiveDates.js';
import { sendRecurringRentReminderEmail } from '../config/mail.js';
import {
  RECURRING_RENT_REMINDER_DAYS,
  listTenantRecurringRentOverview,
} from './recurringRentOverview.service.js';

function tenantPortalUrl(path = '/staff/recurring-rent') {
  const origin = (process.env.PAYOS_RETURN_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
  return `${origin}${path}`;
}

async function wasReminderSent(contractId, billingDueDate) {
  const { rows } = await pool.query(
    `SELECT 1 FROM billing_reminder_logs
     WHERE contract_id = $1 AND billing_due_date = $2
       AND reminder_kind = 'RECURRING_RENT_3DAY' AND channel = 'EMAIL'
     LIMIT 1`,
    [contractId, billingDueDate]
  );
  return rows.length > 0;
}

async function logReminderSent({ tenantId, contractId, billingDueDate }) {
  await pool.query(
    `INSERT INTO billing_reminder_logs (tenant_id, contract_id, billing_due_date, reminder_kind, channel)
     VALUES ($1, $2, $3, 'RECURRING_RENT_3DAY', 'EMAIL')
     ON CONFLICT (contract_id, billing_due_date, reminder_kind, channel) DO NOTHING`,
    [tenantId, contractId, billingDueDate]
  );
}

async function findTenantAdminRecipient(tenantId) {
  const { rows } = await pool.query(
    `SELECT user_id, email, full_name
     FROM users
     WHERE tenant_id = $1 AND role = 'TENANT_ADMIN' AND status = 'ACTIVE'
     ORDER BY created_at ASC
     LIMIT 1`,
    [tenantId]
  );
  return rows[0] ?? null;
}

export async function runRecurringRentReminderJob(asOf = new Date()) {
  const contracts = await Contract.findAll(
    { status: 'ACTIVE', billingCycle: 'MONTHLY' },
    { orderBy: 'created_at ASC' }
  );

  const sent = [];
  const skipped = [];

  for (const contract of contracts) {
    const billingDueIso = getNextBillingDateIso(contract, asOf);
    if (!billingDueIso) {
      skipped.push({ contractId: contract.contractId, reason: 'no_next_billing' });
      continue;
    }

    const refIso = toIsoDateOnly(asOf);
    const daysUntil = refIso
      ? daysBetweenCalendarDates(refIso, billingDueIso)
      : null;
    if (daysUntil !== RECURRING_RENT_REMINDER_DAYS) {
      skipped.push({ contractId: contract.contractId, reason: 'not_reminder_day', daysUntil });
      continue;
    }
    if (await wasReminderSent(contract.contractId, billingDueIso)) {
      skipped.push({
        contractId: contract.contractId,
        contractCode: contract.contractCode,
        reason: 'already_sent',
        billingDueDate: billingDueIso,
      });
      continue;
    }

    const admin = await findTenantAdminRecipient(contract.tenantId);
    if (!admin?.email) {
      skipped.push({ contractId: contract.contractId, reason: 'no_tenant_admin_email' });
      continue;
    }

    const monthlyRent = deriveMonthlyRent(contract);
    const overviewUrl = tenantPortalUrl('/staff/recurring-rent');

    try {
      await sendRecurringRentReminderEmail({
        to: admin.email,
        tenantAdminName: admin.full_name,
        contractCode: contract.contractCode,
        contractName: contract.contractName,
        nextBillingDate: formatDateVi(billingDueIso),
        monthlyRent: monthlyRent.toLocaleString('vi-VN'),
        reminderDays: RECURRING_RENT_REMINDER_DAYS,
        overviewUrl,
      });
      await logReminderSent({
        tenantId: contract.tenantId,
        contractId: contract.contractId,
        billingDueDate: billingDueIso,
      });
      sent.push({ contractId: contract.contractId, email: admin.email, billingDueDate: billingDueIso });
    } catch (err) {
      console.warn('[billing] recurring rent reminder failed:', contract.contractId, err?.message);
      skipped.push({ contractId: contract.contractId, reason: 'email_failed' });
    }
  }

  return { sentCount: sent.length, sent, skippedCount: skipped.length, skipped };
}

/** Alerts cho chuông thông báo tenant. */
export async function getTenantRecurringRentAlerts(user, asOf = new Date()) {
  if (user?.role !== 'TENANT_ADMIN' || !user.tenantId) {
    return {
      dueSoonCount: 0,
      pendingRecurringCount: 0,
      reminderDays: RECURRING_RENT_REMINDER_DAYS,
      recent: [],
    };
  }

  const data = await listTenantRecurringRentOverview(user.tenantId, asOf);

  const recent = data.items
    .filter(
      (i) =>
        i.paymentStatus === 'DUE_SOON' ||
        i.paymentStatus === 'PENDING_INVOICE' ||
        (i.daysUntilNextBilling !== null && i.daysUntilNextBilling <= RECURRING_RENT_REMINDER_DAYS)
    )
    .slice(0, 10)
    .map((i) => ({
      contractId: i.contractId,
      contractCode: i.contractCode,
      warehouseName: i.warehouseName,
      nextBillingDate: i.nextBillingDate,
      nextBillingDateLabel: i.nextBillingDateLabel,
      daysUntilNextBilling: i.daysUntilNextBilling,
      monthlyRent: i.monthlyRent,
      paymentStatus: i.paymentStatus,
      pendingInvoiceId: i.pendingInvoice?.invoiceId ?? null,
      pendingInvoiceCode: i.pendingInvoice?.invoiceCode ?? null,
    }));

  return {
    dueSoonCount: data.dueSoonCount,
    pendingRecurringCount: data.pendingInvoiceCount,
    reminderDays: RECURRING_RENT_REMINDER_DAYS,
    recent,
  };
}
