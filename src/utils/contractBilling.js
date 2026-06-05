import { DAYS_PER_BILLING_MONTH } from '../constants/rentalPricingDefaults.js';
import {
  contractBillingDays,
  contractBillingMonths,
  prorateToBillingMonth,
} from './rentalPeriodPricing.js';

export { contractBillingDays, contractBillingMonths };

/** Số ngày báo trước khi đến kỳ thanh toán tháng tiếp theo (MONTHLY). */
export const TERMINATION_NOTICE_DAYS = 3;

export function contractMonthCount(startDate, endDate) {
  return contractBillingMonths(startDate, endDate);
}

export function deriveMonthlyRent(contract) {
  const total = Number(contract.estimatedTotalAmount) || 0;
  const months = contractBillingMonths(contract.startDate, contract.endDate);
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

function parseInstant(value) {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Mốc thanh toán định kỳ = ngày HĐ ACTIVE; fallback startDate cho HĐ cũ. */
export function getContractBillingAnchor(contract) {
  return parseInstant(contract?.activatedAt) ?? parseInstant(contract?.startDate);
}

function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysBetweenUtc(from, to) {
  const a = startOfUtcDay(from);
  const b = startOfUtcDay(to);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function billingDateInMonth(year, monthIndex, anchorDay) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(anchorDay, lastDay)));
}

/** Kỳ thanh toán MONTHLY tiếp theo (cùng ngày trong tháng với activated_at). */
export function getNextBillingDate(contract, asOf = new Date()) {
  const anchor = getContractBillingAnchor(contract);
  if (!anchor) return null;

  const anchorDay = anchor.getUTCDate();
  const ref = parseInstant(asOf) ?? new Date();

  let candidate = billingDateInMonth(ref.getUTCFullYear(), ref.getUTCMonth(), anchorDay);
  if (candidate <= startOfUtcDay(ref)) {
    const nextMonth = ref.getUTCMonth() + 1;
    const year = ref.getUTCFullYear() + Math.floor(nextMonth / 12);
    const month = nextMonth % 12;
    candidate = billingDateInMonth(year, month, anchorDay);
  }
  return candidate;
}

export function buildTerminationNoticeInfo(contract, asOf = new Date()) {
  const billingCycle = contract.billingCycle ?? 'MONTHLY';
  const anchor = getContractBillingAnchor(contract);

  if (billingCycle !== 'MONTHLY') {
    return {
      contractStartDate: contract.startDate ?? null,
      activatedAt: contract.activatedAt ?? null,
      billingDayOfMonth: anchor ? anchor.getUTCDate() : null,
      terminationNoticeDays: TERMINATION_NOTICE_DAYS,
      appliesNoticeRule: false,
      nextBillingDate: null,
      latestRequestDate: null,
      daysUntilNextBilling: null,
      canRequestNow: true,
    };
  }

  const nextBilling = getNextBillingDate(contract, asOf);
  if (!nextBilling) {
    return {
      contractStartDate: contract.startDate ?? null,
      activatedAt: contract.activatedAt ?? null,
      billingDayOfMonth: null,
      terminationNoticeDays: TERMINATION_NOTICE_DAYS,
      appliesNoticeRule: true,
      nextBillingDate: null,
      latestRequestDate: null,
      daysUntilNextBilling: null,
      canRequestNow: true,
    };
  }

  const ref = parseInstant(asOf) ?? new Date();
  const daysUntil = daysBetweenUtc(ref, nextBilling);
  const latestRequest = new Date(nextBilling);
  latestRequest.setUTCDate(latestRequest.getUTCDate() - TERMINATION_NOTICE_DAYS);

  return {
    contractStartDate: contract.startDate ?? null,
    activatedAt: contract.activatedAt ?? null,
    billingDayOfMonth: anchor ? anchor.getUTCDate() : null,
    terminationNoticeDays: TERMINATION_NOTICE_DAYS,
    appliesNoticeRule: true,
    nextBillingDate: nextBilling.toISOString().slice(0, 10),
    latestRequestDate: latestRequest.toISOString().slice(0, 10),
    daysUntilNextBilling: daysUntil,
    canRequestNow: daysUntil >= TERMINATION_NOTICE_DAYS,
  };
}

export function formatDateVi(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(isoDate);
  return d.toLocaleDateString('vi-VN', { timeZone: 'UTC' });
}

export function usedContractMonths(contract, asOf = new Date()) {
  const start = getContractBillingAnchor(contract);
  if (!start) return 0;
  const ref = parseInstant(asOf) ?? new Date();
  if (ref < start) return 0;
  const diffDays = Math.ceil((ref.getTime() - start.getTime()) / 86400000);
  if (diffDays <= 0) return 0;
  return Math.max(1, Math.floor(diffDays / DAYS_PER_BILLING_MONTH));
}
