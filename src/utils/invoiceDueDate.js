import { INVOICE_PAYMENT_DUE_DAYS } from '../constants/pricingDefaults.js';

export function computeInvoiceDueDate(issuedAt = new Date()) {
  const due = new Date(issuedAt);
  due.setDate(due.getDate() + INVOICE_PAYMENT_DUE_DAYS);
  return due;
}
