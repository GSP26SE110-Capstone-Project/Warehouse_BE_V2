import { DAYS_PER_BILLING_MONTH } from '../constants/rentalPricingDefaults.js';

export function contractMonthCount(startDate, endDate) {
  if (!startDate || !endDate) return 12;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 12;
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  if (diffDays <= 0) return 1;
  return Math.max(1, Math.floor(diffDays / DAYS_PER_BILLING_MONTH));
}

export function deriveMonthlyRent(contract) {
  const total = Number(contract.estimatedTotalAmount) || 0;
  const months = contractMonthCount(contract.startDate, contract.endDate);
  if (months <= 0) return Math.round(total);
  return Math.round(total / months);
}

export function initialInvoiceAmount(contract) {
  const total = Number(contract.estimatedTotalAmount) || 0;
  if (contract.billingCycle === 'YEARLY') {
    return Math.round(total);
  }
  return deriveMonthlyRent(contract);
}

export function usedContractMonths(contract, asOf = new Date()) {
  if (!contract?.startDate) return 0;
  const start = new Date(contract.startDate);
  const ref = new Date(asOf);
  if (Number.isNaN(start.getTime()) || ref < start) return 0;
  const diffDays = Math.ceil((ref.getTime() - start.getTime()) / 86400000);
  if (diffDays <= 0) return 0;
  return Math.max(1, Math.floor(diffDays / DAYS_PER_BILLING_MONTH));
}
