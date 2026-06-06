/** Tham chiếu docs/pricing.md — ước tính hợp đồng khi onboarding */

export const WAREHOUSE_PRICE_PER_M2_MONTH = 180_000;

export const ZONE_PRICE_PER_M2_MONTH = Object.freeze({
  SHARED: 120_000,
  PREMIUM: 250_000,
  PRIVATE: 200_000,
});

export const DAYS_PER_BILLING_MONTH = 30;

/** Giá box/tháng trung bình (SHARED_STORAGE) — trung bình 4 loại thùng */
export const SHARED_STORAGE_AVG_BOX_MONTH = 23_750;

/** Giá box/day trung bình (prorate từ tháng) */
export const SHARED_STORAGE_AVG_BOX_DAY = Math.round(
  SHARED_STORAGE_AVG_BOX_MONTH / DAYS_PER_BILLING_MONTH
);

export const PREMIUM_STORAGE_SURCHARGE_RATIO = 1.2;
