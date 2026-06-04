import { DAYS_PER_BILLING_MONTH } from '../constants/rentalPricingDefaults.js';
import { STORAGE_BOX_DAY_PRICE_BY_BOX_TYPE } from '../constants/pricingDefaults.js';

/**
 * Số tháng lịch trong kỳ HĐ (vd. 4/6/2026 → 4/6/2027 = 12).
 * Dùng cho thuê nguyên kho / nguyên zone: m² × đơn giá m²/tháng × số tháng.
 */
export function contractBillingMonths(startDate, endDate) {
  if (!startDate || !endDate) return 12;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 12;
  }
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) {
    months -= 1;
  }
  return Math.max(1, months);
}

/**
 * Số ngày thuê theo kỳ HĐ (start → end), tối thiểu 1.
 * Dùng cho thuê theo thùng: giá/ngày × số thùng × số ngày.
 */
export function contractBillingDays(startDate, endDate) {
  if (!startDate || !endDate) return DAYS_PER_BILLING_MONTH;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return DAYS_PER_BILLING_MONTH;
  }
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  if (diffDays <= 0) return 1;
  return diffDays;
}

/** Tiền cả kỳ thuê theo m²: diện tích × đơn giá m²/tháng × số tháng lịch. */
export function amountAreaM2ForBillingPeriod(areaM2, ratePerM2Month, billingMonths) {
  const area = Number(areaM2);
  const rate = Number(ratePerM2Month);
  const months = Number(billingMonths);
  if (!Number.isFinite(area) || area <= 0 || !Number.isFinite(rate) || rate <= 0) {
    return 0;
  }
  if (!Number.isFinite(months) || months <= 0) return 0;
  return Math.round(area * rate * months);
}

export function parseBoxAllocationFromRental(rr) {
  let raw = rr?.boxAllocation ?? rr?.boxAllocationJson;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];

  return raw
    .map((row) => ({
      boxType: String(row.boxType ?? row.box_type ?? '').toUpperCase(),
      count: Number(row.count) || 0,
    }))
    .filter((row) => row.count > 0 && STORAGE_BOX_DAY_PRICE_BY_BOX_TYPE[row.boxType]);
}

/** Fallback khi chưa có boxAllocation (legacy). */
export function resolveBoxAllocationForPricing(rr) {
  const parsed = parseBoxAllocationFromRental(rr);
  if (parsed.length) return parsed;

  const n = Number(rr?.estimatedBoxCount) || 0;
  if (n > 0) {
    return [{ boxType: 'MEDIUM', count: n }];
  }
  return [{ boxType: 'MEDIUM', count: 1 }];
}

export function dailyBoxRentFromAllocation(allocation) {
  let sum = 0;
  for (const row of allocation) {
    const unit = STORAGE_BOX_DAY_PRICE_BY_BOX_TYPE[row.boxType];
    if (!unit) continue;
    sum += row.count * unit;
  }
  return sum;
}

/** Tiền cả kỳ: Σ (số thùng × giá/ngày theo loại) × số ngày. */
export function amountBoxAllocationForBillingPeriod(allocation, billingDays) {
  const daily = dailyBoxRentFromAllocation(allocation);
  const days = Number(billingDays);
  if (daily <= 0 || days <= 0) return 0;
  return Math.round(daily * days);
}

/** Tiền tương đương 30 ngày (hiển thị / hóa đơn tháng đầu MONTHLY). */
export function prorateToBillingMonth(periodTotal, billingDays) {
  const total = Number(periodTotal) || 0;
  const days = Number(billingDays) || DAYS_PER_BILLING_MONTH;
  if (days <= 0) return Math.round(total);
  return Math.round((total * DAYS_PER_BILLING_MONTH) / days);
}
