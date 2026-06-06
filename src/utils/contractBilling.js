import { DAYS_PER_BILLING_MONTH } from '../constants/rentalPricingDefaults.js';
import {
  contractBillingDays,
  contractBillingMonths,
  prorateToBillingMonth,
} from './rentalPeriodPricing.js';
import { toIsoDateOnly } from './rentalEffectiveDates.js';

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
  return deriveMonthlyRent(contract);
}

function parseIsoParts(iso) {
  const normalized = toIsoDateOnly(iso);
  if (!normalized) return null;
  const [y, m, d] = normalized.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function formatIsoDate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function lastDayOfCalendarMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function billingDateInCalendarMonth(year, month, anchorDay) {
  const day = Math.min(anchorDay, lastDayOfCalendarMonth(year, month));
  return formatIsoDate(year, month, day);
}

/** Số ngày giữa hai mốc YYYY-MM-DD (lịch, không lệch UTC+7). */
export function daysBetweenCalendarDates(fromValue, toValue) {
  const fromIso = toIsoDateOnly(fromValue);
  const toIso = toIsoDateOnly(toValue);
  const a = parseIsoParts(fromIso);
  const b = parseIsoParts(toIso);
  if (!a || !b) return 0;
  const start = Date.UTC(a.y, a.m - 1, a.d);
  const end = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((end - start) / 86400000);
}

function addCalendarDays(isoValue, deltaDays) {
  const iso = toIsoDateOnly(isoValue);
  const parts = parseIsoParts(iso);
  if (!parts) return null;
  const d = new Date(parts.y, parts.m - 1, parts.d);
  d.setDate(d.getDate() + deltaDays);
  return formatIsoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Mốc thanh toán định kỳ = ngày WH approve (startDate), dạng YYYY-MM-DD. */
export function getContractBillingAnchorIso(contract) {
  return toIsoDateOnly(contract?.startDate);
}

/** @deprecated Dùng getContractBillingAnchorIso — giữ để tương thích đọc cũ. */
export function getContractBillingAnchor(contract) {
  const iso = getContractBillingAnchorIso(contract);
  if (!iso) return null;
  const parts = parseIsoParts(iso);
  return new Date(parts.y, parts.m - 1, parts.d);
}

export function getBillingDayOfMonth(contract) {
  const parts = parseIsoParts(getContractBillingAnchorIso(contract));
  return parts?.d ?? null;
}

/** Kỳ thanh toán MONTHLY tiếp theo (cùng ngày trong tháng với startDate). */
export function getNextBillingDateIso(contract, asOf = new Date()) {
  const anchorIso = getContractBillingAnchorIso(contract);
  const anchorParts = parseIsoParts(anchorIso);
  if (!anchorParts) return null;

  const refIso = toIsoDateOnly(asOf);
  const refParts = parseIsoParts(refIso);
  if (!refParts) return null;

  let candidateIso = billingDateInCalendarMonth(
    refParts.y,
    refParts.m,
    anchorParts.d
  );

  if (candidateIso <= refIso) {
    let nextMonth = refParts.m + 1;
    let nextYear = refParts.y;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    candidateIso = billingDateInCalendarMonth(nextYear, nextMonth, anchorParts.d);
  }

  return candidateIso;
}

/** Trả Date local midnight — ưu tiên dùng getNextBillingDateIso. */
export function getNextBillingDate(contract, asOf = new Date()) {
  const iso = getNextBillingDateIso(contract, asOf);
  const parts = parseIsoParts(iso);
  if (!parts) return null;
  return new Date(parts.y, parts.m - 1, parts.d);
}

export function isContractBillingDayToday(contract, asOf = new Date()) {
  const anchorDay = getBillingDayOfMonth(contract);
  if (!anchorDay) return false;
  const refIso = toIsoDateOnly(asOf);
  const refParts = parseIsoParts(refIso);
  if (!refParts) return false;
  const candidateIso = billingDateInCalendarMonth(refParts.y, refParts.m, anchorDay);
  return candidateIso === refIso;
}

export function isContractFirstBillingMonth(contract, asOf = new Date()) {
  const anchorIso = getContractBillingAnchorIso(contract);
  const refIso = toIsoDateOnly(asOf);
  if (!anchorIso || !refIso) return true;
  return anchorIso.slice(0, 7) === refIso.slice(0, 7);
}

/**
 * Kỳ tiền thuê RECURRING_RENT: từ ngày billing (cùng ngày startDate) đến cùng ngày tháng sau.
 * VD startDate 6/6, billing 6/7 → kỳ 6/7 → 6/8.
 */
export function getRecurringBillingPeriodIso(contract, asOf = new Date()) {
  const anchorDay = getBillingDayOfMonth(contract);
  const refIso = toIsoDateOnly(asOf);
  const refParts = parseIsoParts(refIso);
  if (!anchorDay || !refParts) return { periodStart: null, periodEnd: null };

  const periodStart = billingDateInCalendarMonth(refParts.y, refParts.m, anchorDay);

  let nextMonth = refParts.m + 1;
  let nextYear = refParts.y;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const periodEnd = billingDateInCalendarMonth(nextYear, nextMonth, anchorDay);

  return { periodStart, periodEnd };
}

export function buildTerminationNoticeInfo(contract, asOf = new Date()) {
  const billingCycle = contract.billingCycle ?? 'MONTHLY';
  const billingDay = getBillingDayOfMonth(contract);

  if (billingCycle !== 'MONTHLY') {
    return {
      contractStartDate: contract.startDate ?? null,
      activatedAt: contract.activatedAt ?? null,
      billingDayOfMonth: billingDay,
      terminationNoticeDays: TERMINATION_NOTICE_DAYS,
      appliesNoticeRule: false,
      nextBillingDate: null,
      latestRequestDate: null,
      daysUntilNextBilling: null,
      canRequestNow: true,
    };
  }

  const nextBillingIso = getNextBillingDateIso(contract, asOf);
  if (!nextBillingIso) {
    return {
      contractStartDate: contract.startDate ?? null,
      activatedAt: contract.activatedAt ?? null,
      billingDayOfMonth: billingDay,
      terminationNoticeDays: TERMINATION_NOTICE_DAYS,
      appliesNoticeRule: true,
      nextBillingDate: null,
      latestRequestDate: null,
      daysUntilNextBilling: null,
      canRequestNow: true,
    };
  }

  const refIso = toIsoDateOnly(asOf);
  const daysUntil = daysBetweenCalendarDates(refIso, nextBillingIso);
  const latestRequestIso = addCalendarDays(nextBillingIso, -TERMINATION_NOTICE_DAYS);

  return {
    contractStartDate: contract.startDate ?? null,
    activatedAt: contract.activatedAt ?? null,
    billingDayOfMonth: billingDay,
    terminationNoticeDays: TERMINATION_NOTICE_DAYS,
    appliesNoticeRule: true,
    nextBillingDate: nextBillingIso,
    latestRequestDate: latestRequestIso,
    daysUntilNextBilling: daysUntil,
    canRequestNow: daysUntil >= TERMINATION_NOTICE_DAYS,
  };
}

export function formatDateVi(isoDate) {
  if (!isoDate) return '—';
  const iso = toIsoDateOnly(isoDate);
  if (!iso) return String(isoDate);
  const parts = parseIsoParts(iso);
  if (!parts) return String(isoDate);
  const d = new Date(parts.y, parts.m - 1, parts.d);
  return d.toLocaleDateString('vi-VN');
}

export function usedContractMonths(contract, asOf = new Date()) {
  const startIso = getContractBillingAnchorIso(contract);
  if (!startIso) return 0;
  const refIso = toIsoDateOnly(asOf);
  if (!refIso || refIso < startIso) return 0;
  const diffDays = daysBetweenCalendarDates(startIso, refIso);
  if (diffDays <= 0) return 0;
  return Math.max(1, Math.floor(diffDays / DAYS_PER_BILLING_MONTH));
}
