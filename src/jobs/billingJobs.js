import cron from 'node-cron';
import { runRecurringRentBillingJob } from '../services/recurringInvoice.service.js';
import { processOverdueInvoices } from '../services/invoiceOverdue.service.js';
import { runRecurringRentReminderJob } from '../services/recurringRentReminder.service.js';

export async function runDailyBillingJobs(asOf = new Date()) {
  const reminders = await runRecurringRentReminderJob(asOf);
  const recurring = await runRecurringRentBillingJob(asOf);
  const overdue = await processOverdueInvoices(asOf);
  return {
    remindersSent: reminders.sentCount,
    reminderSkipped: reminders.skipped ?? [],
    recurringCreated: recurring.length,
    overdueTerminated: overdue.terminatedCount,
  };
}

const DEFAULT_BILLING_CRON = '5 1 * * *';

function billingCronExpression() {
  const custom = process.env.BILLING_CRON_SCHEDULE?.trim();
  return custom || DEFAULT_BILLING_CRON;
}

async function runBillingWithLog(label) {
  try {
    const result = await runDailyBillingJobs();
    console.log(`[billing] ${label}:`, {
      remindersSent: result.remindersSent,
      recurringCreated: result.recurringCreated,
      overdueTerminated: result.overdueTerminated,
    });
    if (result.reminderSkipped?.length) {
      const notable = result.reminderSkipped.filter((s) =>
        ['already_sent', 'email_failed', 'no_tenant_admin_email'].includes(s.reason)
      );
      if (notable.length) {
        console.log(`[billing] ${label} reminder skips:`, notable);
      }
    }
    return result;
  } catch (err) {
    console.warn(`[billing] ${label} failed:`, err?.message ?? err);
    return null;
  }
}

export function startBillingCron() {
  if (process.env.DISABLE_BILLING_CRON === '1') {
    console.log('[billing] cron disabled (DISABLE_BILLING_CRON=1)');
    return;
  }

  if (process.env.BILLING_RUN_ON_START === '1') {
    void runBillingWithLog('startup job');
  }

  const expression = billingCronExpression();
  if (!cron.validate(expression)) {
    console.warn(
      `[billing] invalid BILLING_CRON_SCHEDULE "${expression}" — fallback ${DEFAULT_BILLING_CRON}`
    );
    cron.schedule(DEFAULT_BILLING_CRON, () => {
      void runBillingWithLog('daily job');
    });
    console.log(`[billing] cron scheduled (${DEFAULT_BILLING_CRON})`);
    return;
  }

  cron.schedule(expression, () => {
    void runBillingWithLog('scheduled job');
  });

  console.log(`[billing] cron scheduled (${expression})`);
}
