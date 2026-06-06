import { BOX_TYPE } from "./warehouseStructure.js";

/**
 * Giới hạn vật lý mặc định cho bin (seed / ước tính).
 *
 * Quy ước: `DEFAULT_BIN_MAX_LPN_COUNT = DEFAULT_BIN_MAX_VOLUME_UNITS` để LPN count
 * không phải là constraint chặn — bin chỉ chặn bởi volume. Vì mỗi SMALL = 1 volume
 * unit, upper bound vật lý của số LPN trong 1 bin = số volume units. Cho phép tenant
 * nhập tổ hợp box bất kỳ (1 EXTRA + 1 LARGE + 4 SMALL = 16 vol, 6 LPN) mà không bị
 * cap LPN làm phí chỗ.
 */
export const DEFAULT_BIN_MAX_VOLUME_UNITS = 16;
export const DEFAULT_BIN_MAX_LPN_COUNT = DEFAULT_BIN_MAX_VOLUME_UNITS;

export const DAYS_PER_BILLING_MONTH = 30;

export const INVOICE_PAYMENT_DUE_DAYS = 3;

/** Phí inbound LPN theo box type (thu trước khi WH duyệt) */
export const INBOUND_LPN_PRICE_BY_BOX_TYPE = Object.freeze({
  SMALL: 2_000,
  MEDIUM: 3_000,
  LARGE: 5_000,
  EXTRA: 8_000,
});

/** Phí outbound LPN — cùng bảng giá inbound */
export const OUTBOUND_LPN_PRICE_BY_BOX_TYPE = Object.freeze({
  SMALL: 2_000,
  MEDIUM: 3_000,
  LARGE: 5_000,
  EXTRA: 8_000,
});

export const WAREHOUSE_TRANSPORT_FEE_FLAT = 250_000;

/** Giá lưu kho box/tháng theo box type (nguồn gốc — flat /tháng) */
export const STORAGE_BOX_MONTH_PRICE_BY_BOX_TYPE = Object.freeze({
  SMALL: 10_000,
  MEDIUM: 15_000,
  LARGE: 25_000,
  EXTRA: 45_000,
});

/** Prorate BOX_DAY billing từ giá tháng */
export const STORAGE_BOX_DAY_PRICE_BY_BOX_TYPE = Object.freeze({
  SMALL: Math.round(
    STORAGE_BOX_MONTH_PRICE_BY_BOX_TYPE.SMALL / DAYS_PER_BILLING_MONTH,
  ),
  MEDIUM: Math.round(
    STORAGE_BOX_MONTH_PRICE_BY_BOX_TYPE.MEDIUM / DAYS_PER_BILLING_MONTH,
  ),
  LARGE: Math.round(
    STORAGE_BOX_MONTH_PRICE_BY_BOX_TYPE.LARGE / DAYS_PER_BILLING_MONTH,
  ),
  EXTRA: Math.round(
    STORAGE_BOX_MONTH_PRICE_BY_BOX_TYPE.EXTRA / DAYS_PER_BILLING_MONTH,
  ),
});

export const HANDLING_UNIT_FALLBACK_PRICE = 10000;

/** Mẫu contract_items khi tạo hợp đồng mới. */
export function buildDefaultContractItemRows(contractId) {
  const rows = [];

  for (const boxType of BOX_TYPE) {
    rows.push({
      contractId,
      itemType: "INBOUND",
      billingUnit: "INBOUND_LPN",
      boxType,
      unitPrice: INBOUND_LPN_PRICE_BY_BOX_TYPE[boxType],
    });
    rows.push({
      contractId,
      itemType: "OUTBOUND",
      billingUnit: "OUTBOUND_LPN",
      boxType,
      unitPrice: OUTBOUND_LPN_PRICE_BY_BOX_TYPE[boxType],
    });
    rows.push({
      contractId,
      itemType: "STORAGE",
      storageLevel: "BIN",
      billingUnit: "BOX_DAY",
      boxType,
      unitPrice: STORAGE_BOX_DAY_PRICE_BY_BOX_TYPE[boxType],
    });
  }

  rows.push({
    contractId,
    itemType: "HANDLING",
    billingUnit: "HANDLING_UNIT",
    unitPrice: HANDLING_UNIT_FALLBACK_PRICE,
  });

  return rows;
}
