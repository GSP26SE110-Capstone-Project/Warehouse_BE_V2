import pool from '../config/db.js';
import Invoice from '../models/Invoice.js';
import Contract from '../models/Contract.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import { INVOICE_CATEGORY } from '../constants/tenantOnboarding.js';
import { initialInvoiceAmount } from '../utils/contractBilling.js';
import { getContract } from './contract.service.js';
import { notifyWarehouseAdminContractPaymentReceived } from './contractNotify.service.js';
import { activateAppendixAfterPayment } from './contractAppendixInvoice.service.js';

function generateInvoiceCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000)
    .toString(36)
    .toUpperCase()
    .padStart(2, '0');
  return `INV-${ts}-${rand}`;
}

function toDateOnly(value) {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function findInitialInvoice(contractId) {
  const id = parseUuid(contractId, 'contractId');
  const items = await Invoice.findAll(
    { contractId: id, invoiceCategory: 'INITIAL' },
    { orderBy: 'created_at DESC', limit: 1 }
  );
  return items[0] ?? null;
}

export async function hasPaidInitialInvoice(contractId) {
  const inv = await findInitialInvoice(contractId);
  return inv?.paymentStatus === 'PAID';
}

export async function listContractInvoices(contractId) {
  const id = parseUuid(contractId, 'contractId');
  await getContract(id);
  return Invoice.findAll({ contractId: id }, { orderBy: 'created_at DESC' });
}

export async function createInitialInvoice(contract) {
  const contractId = contract.contractId;
  const existing = await findInitialInvoice(contractId);
  if (existing) return existing;

  const amount = initialInvoiceAmount(contract);
  if (amount <= 0) {
    throw new AppError(
      'Hợp đồng chưa có estimatedTotalAmount — không tạo được invoice đầu',
      400,
      'VALIDATION_ERROR'
    );
  }

  const start = toDateOnly(contract.startDate);
  const end = toDateOnly(contract.endDate);
  const due = new Date();
  due.setDate(due.getDate() + 7);

  const label =
    contract.billingCycle === 'YEARLY'
      ? 'Thanh toán tiền thuê cả kỳ hợp đồng'
      : 'Thanh toán tiền thuê tháng đầu';

  const invoice = await Invoice.create({
    tenantId: contract.tenantId,
    contractId,
    invoiceCode: generateInvoiceCode(),
    billingStartDate: start,
    billingEndDate: end,
    subtotal: amount,
    tax: 0,
    totalAmount: amount,
    paymentStatus: 'PENDING',
    invoiceCategory: 'INITIAL',
    issuedAt: new Date(),
    dueDate: due,
  });

  await pool.query(
    `INSERT INTO invoice_items (invoice_id, item_type, description, quantity, unit_price, total_price)
     VALUES ($1, 'STORAGE', $2, 1, $3, $3)`,
    [invoice.invoiceId, label, amount]
  );

  return invoice;
}

export async function markInvoicePaid(contractId, invoiceId) {
  const cId = parseUuid(contractId, 'contractId');
  const iId = parseUuid(invoiceId, 'invoiceId');
  const contract = await getContract(cId);
  const invoice = await Invoice.findById(iId);

  if (!invoice || invoice.contractId !== cId) {
    throw new AppError('Invoice not found for this contract', 404, 'NOT_FOUND');
  }
  if (invoice.paymentStatus === 'PAID') {
    return { invoice, contract };
  }

  const activatingContract =
    invoice.invoiceCategory === 'INITIAL' && contract.status === 'PENDING_PAYMENT';
  const activatingAppendix =
    invoice.invoiceCategory === 'APPENDIX_INITIAL' && invoice.appendixId;

  const updatedInvoice = await Invoice.updateById(iId, { paymentStatus: 'PAID' });

  let updatedContract = contract;
  let appendix = null;

  if (activatingContract) {
    const paidAtResult = await pool.query(
      `SELECT paid_at
       FROM payments
       WHERE invoice_id = $1 AND payment_status = 'SUCCESS'
       ORDER BY paid_at DESC NULLS LAST
       LIMIT 1`,
      [iId]
    );
    const activatedAt = paidAtResult.rows[0]?.paid_at ?? new Date();
    updatedContract = await Contract.updateById(cId, {
      status: 'ACTIVE',
      activatedAt,
    });
    void notifyWarehouseAdminContractPaymentReceived({
      contract: updatedContract,
      invoice: updatedInvoice,
    }).catch((err) => {
      console.warn('[contract] WH admin payment notify failed:', err?.message ?? err);
    });
  }

  if (activatingAppendix) {
    appendix = await activateAppendixAfterPayment(invoice.appendixId);
  }

  return { invoice: updatedInvoice, contract: updatedContract, appendix };
}

export async function assertInitialInvoicePaid(contractId) {
  const paid = await hasPaidInitialInvoice(contractId);
  if (!paid) {
    throw new AppError(
      'Hợp đồng chưa thanh toán invoice đầu — chưa thể kích hoạt hoặc tạo inbound',
      400,
      'CONTRACT_PAYMENT_REQUIRED'
    );
  }
}

export { INVOICE_CATEGORY };
