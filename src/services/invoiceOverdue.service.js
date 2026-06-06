import pool from '../config/db.js';
import Contract from '../models/Contract.js';
import Invoice from '../models/Invoice.js';
import { terminateAllAppendicesForContract } from './contractAppendix.service.js';

async function applyOverdueTerminationSideEffects(client, contract) {
  await client.query(
    `UPDATE storage_reservations
     SET status = 'CANCELLED', updated_at = NOW()
     WHERE contract_id = $1 AND status = 'ACTIVE'`,
    [contract.contractId]
  );

  await client.query(
    `UPDATE inbound_requests
     SET status = 'CANCELLED', updated_at = NOW()
     WHERE contract_id = $1 AND status IN ('DRAFT', 'PENDING')`,
    [contract.contractId]
  );

  await client.query(
    `UPDATE invoices
     SET payment_status = 'OVERDUE', updated_at = NOW()
     WHERE contract_id = $1 AND payment_status = 'PENDING' AND due_date < NOW()`,
    [contract.contractId]
  );
}

export async function processOverdueInvoices(asOf = new Date()) {
  const { rows } = await pool.query(
    `SELECT DISTINCT i.contract_id
     FROM invoices i
     INNER JOIN contracts c ON c.contract_id = i.contract_id
     WHERE i.payment_status = 'PENDING'
       AND i.due_date < $1
       AND c.status IN ('ACTIVE', 'PENDING_PAYMENT')`,
    [asOf]
  );

  const terminated = [];
  for (const row of rows) {
    const contract = await Contract.findById(row.contract_id);
    if (!contract) continue;
    if (!['ACTIVE', 'PENDING_PAYMENT'].includes(contract.status)) continue;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await Contract.updateById(
        contract.contractId,
        { status: 'TERMINATED' },
        client
      );
      await applyOverdueTerminationSideEffects(client, contract);
      await client.query('COMMIT');
      await terminateAllAppendicesForContract(contract.contractId).catch(() => {});
      terminated.push(contract.contractId);
    } catch (err) {
      await client.query('ROLLBACK');
      console.warn('[billing] overdue terminate failed:', err?.message ?? err);
    } finally {
      client.release();
    }
  }

  return { terminatedCount: terminated.length, contractIds: terminated };
}
