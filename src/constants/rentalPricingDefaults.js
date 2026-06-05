/** Tham chiếu docs/pricing.md — ước tính hợp đồng khi onboarding */

export const WAREHOUSE_PRICE_PER_M2_MONTH = 120_000;

export const ZONE_PRICE_PER_M2_MONTH = Object.freeze({
  SHARED: 120_000,
  PREMIUM: 300_000,
  PRIVATE: 250_000,
});

export const DAYS_PER_BILLING_MONTH = 30;

/** Giá box/day trung bình (SHARED_STORAGE) */
export const SHARED_STORAGE_AVG_BOX_DAY = 20_000;

/** Giá box/tháng trung bình (SHARED_STORAGE) = avg day × 30 */
export const SHARED_STORAGE_AVG_BOX_MONTH = SHARED_STORAGE_AVG_BOX_DAY * DAYS_PER_BILLING_MONTH;

export const PREMIUM_STORAGE_SURCHARGE_RATIO = 1.2;
