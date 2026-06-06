import { contractBillingMonths } from './rentalPeriodPricing.js';

const MIN_RENTAL_DAYS = 30;

/** YYYY-MM-DD theo lịch local — không dùng toISOString (tránh lùi 1 ngày ở UTC+7). */
function formatLocalIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toIsoDateOnly(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return formatLocalIsoDate(d);
}

function parseIsoDateOnly(value) {
  const iso = toIsoDateOnly(value);
  if (!iso) return null;
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y, m - 1, day);
}

export function startOfDayLocal(date = new Date()) {
  return formatLocalIsoDate(date);
}

export function addCalendarMonthsToDateOnly(startDate, monthCount) {
  if (!startDate || monthCount <= 0) return '';
  const start = parseIsoDateOnly(startDate);
  if (!start || Number.isNaN(start.getTime())) return '';
  const end = new Date(start.getFullYear(), start.getMonth() + monthCount, start.getDate());
  return formatLocalIsoDate(end);
}

function estimateRentalDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  return diffDays > 0 ? diffDays : 0;
}

function meetsMinimumRentalDuration(startDate, endDate) {
  return estimateRentalDays(startDate, endDate) >= MIN_RENTAL_DAYS;
}

/**
 * Khi WH duyệt muộn: dịch start lên effectiveFrom, end = start + billingMonths lịch.
 * @param {string|Date|null} expectedStart
 * @param {string|Date|null} expectedEnd
 * @param {string} [effectiveFrom]
 */
export function resolveEffectiveContractDates(
  expectedStart,
  expectedEnd,
  effectiveFrom = startOfDayLocal()
) {
  const start = toIsoDateOnly(expectedStart);
  const end = toIsoDateOnly(expectedEnd);
  if (!start || !end) {
    return {
      startDate: start ?? '',
      endDate: end ?? '',
      shifted: false,
      billingMonths: 0,
    };
  }

  const billingMonths = contractBillingMonths(start, end);

  if (start >= effectiveFrom) {
    return { startDate: start, endDate: end, shifted: false, billingMonths };
  }

  const effectiveStart = effectiveFrom;
  const effectiveEnd = addCalendarMonthsToDateOnly(effectiveStart, billingMonths);
  if (!effectiveEnd || !meetsMinimumRentalDuration(effectiveStart, effectiveEnd)) {
    return { startDate: start, endDate: end, shifted: false, billingMonths };
  }

  return {
    startDate: effectiveStart,
    endDate: effectiveEnd,
    shifted: true,
    billingMonths,
    requestedStartDate: start,
    requestedEndDate: end,
  };
}

export function startOfDayUtc(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
