import pool from '../config/db.js';
import Invoice from '../models/Invoice.js';
import ContractAppendix from '../models/ContractAppendix.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import {
  appendixInitialInvoiceAmount,
  appendixPaymentBreakdown,
} from '../utils/contractAppendixBilling.js';
import { getContract } from './contract.service.js';
import { computeInvoiceDueDate } from '../utils/invoiceDueDate.js';

function generateInvoiceCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000)
    .toString(36)
    .toUpperCase()
    .padStart(2, '0');
  return `INV-${ts}-${rand}`;
}

export async function findAppendixInitialInvoice(appendixId) {
  const id = parseUuid(appendixId, 'appendixId');
  const items = await Invoice.findAll(
    { appendixId: id, invoiceCategory: 'APPENDIX_INITIAL' },
    { orderBy: 'created_at DESC', limit: 1 }
  );
  return items[0] ?? null;
}

export async function createAppendixInitialInvoice(appendix, parentContract) {
  const appendixId = appendix.appendixId;
  const existing = await findAppendixInitialInvoice(appendixId);
  if (existing) return existing;

  const breakdown = appendixPaymentBreakdown(appendix);
  const amount = breakdown.amount;
  if (amount <= 0) {
    throw new AppError(
      'Phụ lục chưa có estimatedDeltaAmount — không tạo được invoice',
      400,
      'VALIDATION_ERROR'
    );
  }

  const issuedAt = new Date();
  const due = computeInvoiceDueDate(issuedAt);

  const label = `Thanh toán phụ lục ${appendix.appendixCode} (${breakdown.billableMonths} tháng × ${breakdown.monthlyRate}đ/tháng)`;

  const invoice = await Invoice.create({
    tenantId: parentContract.tenantId,
    contractId: parentContract.contractId,
    appendixId,
    invoiceCode: generateInvoiceCode(),
    billingStartDate: breakdown.billingStartDate,
    billingEndDate: breakdown.billingEndDate,
    subtotal: amount,
    tax: 0,
    totalAmount: amount,
    paymentStatus: 'PENDING',
    invoiceCategory: 'APPENDIX_INITIAL',
    issuedAt,
    dueDate: due,
  });

  await pool.query(
    `INSERT INTO invoice_items (invoice_id, item_type, description, quantity, unit_price, total_price)
     VALUES ($1, 'STORAGE', $2, 1, $3, $3)`,
    [invoice.invoiceId, label, amount]
  );

  return invoice;
}

export async function activateAppendixAfterPayment(appendixId) {
  const id = parseUuid(appendixId, 'appendixId');
  const appendix = await ContractAppendix.findById(id);
  if (!appendix) {
    throw new AppError('Phụ lục không tồn tại', 404, 'NOT_FOUND');
  }
  if (appendix.status === 'ACTIVE') {
    return appendix;
  }
  if (appendix.status !== 'PENDING_PAYMENT') {
    throw new AppError(
      'Phụ lục không ở trạng thái chờ thanh toán',
      400,
      'VALIDATION_ERROR'
    );
  }

  const updated = await ContractAppendix.updateById(id, {
    status: 'ACTIVE',
    updatedAt: new Date(),
  });

  await pool.query(
    `UPDATE storage_reservations
     SET status = 'ACTIVE', updated_at = NOW()
     WHERE appendix_id = $1 AND status = 'CANCELLED'`,
    [id]
  );

  return updated;
}

export async function markAppendixInvoicePaid(contractId, invoiceId) {
  const appendix = await resolveAppendixFromInvoice(contractId, invoiceId);
  return activateAppendixAfterPayment(appendix.appendixId);
}

async function resolveAppendixFromInvoice(contractId, invoiceId) {
  const cId = parseUuid(contractId, 'contractId');
  const iId = parseUuid(invoiceId, 'invoiceId');
  const invoice = await Invoice.findById(iId);
  if (!invoice || invoice.contractId !== cId) {
    throw new AppError('Invoice not found for this contract', 404, 'NOT_FOUND');
  }
  if (invoice.invoiceCategory !== 'APPENDIX_INITIAL' || !invoice.appendixId) {
    throw new AppError('Invoice không thuộc phụ lục', 400, 'VALIDATION_ERROR');
  }
  const appendix = await ContractAppendix.findById(invoice.appendixId);
  if (!appendix || appendix.contractId !== cId) {
    throw new AppError('Phụ lục không tồn tại', 404, 'NOT_FOUND');
  }
  return appendix;
}
