export function toDateOnlyUTC(value) {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function daysInMonthUTC(date) {
  const d = toDateOnlyUTC(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

export function endOfMonthUTC(date) {
  const d = toDateOnlyUTC(date);
  const last = daysInMonthUTC(d);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), last));
}

export function startOfMonthUTC(date) {
  const d = toDateOnlyUTC(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Số ngày inclusive [start, end] (UTC date-only). */
export function daysInclusiveUTC(start, end) {
  const s = toDateOnlyUTC(start);
  const e = toDateOnlyUTC(end);
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000);
  return Math.max(0, diff + 1);
}

/**
 * Số tháng tính phí (có thập phân): tháng đầu/cuối theo ngày thực tế, tháng giữa = 1.
 * VD active giữa tháng 1 → hết tháng 3 ≈ 2,5 tháng.
 */
export function billableFractionalMonths(start, end) {
  const s = toDateOnlyUTC(start);
  const e = toDateOnlyUTC(end);
  if (e < s) return 0;

  if (s.getUTCFullYear() === e.getUTCFullYear() && s.getUTCMonth() === e.getUTCMonth()) {
    const dim = daysInMonthUTC(s);
    return dim > 0 ? daysInclusiveUTC(s, e) / dim : 0;
  }

  const dimFirst = daysInMonthUTC(s);
  const firstPart = dimFirst > 0 ? daysInclusiveUTC(s, endOfMonthUTC(s)) / dimFirst : 0;

  const dimLast = daysInMonthUTC(e);
  const lastPart =
    dimLast > 0 ? daysInclusiveUTC(startOfMonthUTC(e), e) / dimLast : 0;

  let middleFullMonths = 0;
  let cursor = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1));
  const lastMonthStart = startOfMonthUTC(e);
  while (cursor < lastMonthStart) {
    middleFullMonths += 1;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  return firstPart + middleFullMonths + lastPart;
}

/**
 * `estimatedDeltaAmount` = tiền thuê bổ sung **mỗi tháng** (1 tháng đủ ngày).
 * Invoice PL = monthlyRate × số tháng theo hạn PL (một lần, không phụ thuộc billingCycle HĐ gốc).
 */
export function appendixPaymentBreakdown(appendix) {
  const monthlyRate = Number(appendix.estimatedDeltaAmount) || 0;
  const effective = toDateOnlyUTC(appendix.effectiveDate);
  const end = toDateOnlyUTC(appendix.endDate);
  const billableMonths = billableFractionalMonths(effective, end);
  const amount = Math.round(monthlyRate * billableMonths);

  return {
    monthlyRate,
    billableMonths: Math.round(billableMonths * 1000) / 1000,
    amount,
    billingStartDate: effective,
    billingEndDate: end,
  };
}

export function appendixInitialInvoiceAmount(appendix) {
  return appendixPaymentBreakdown(appendix).amount;
}
