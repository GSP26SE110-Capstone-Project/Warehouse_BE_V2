import { BOX_TYPE } from './warehouseStructure.js';

/** Giới hạn vật lý mặc định cho bin (seed / ước tính). */
export const DEFAULT_BIN_MAX_LPN_COUNT = 4;
/** 16 volume units → tối đa 2 LPN EXTRA (8+8) hoặc 4 LPN MEDIUM trong 1 bin. */
export const DEFAULT_BIN_MAX_VOLUME_UNITS = 16;

export const DAYS_PER_BILLING_MONTH = 30;

/** docs/pricing.md — inbound LPN theo box type */
export const INBOUND_LPN_PRICE_BY_BOX_TYPE = Object.freeze({
  SMALL: 10000,
  MEDIUM: 20000,
  LARGE: 35000,
  EXTRA: 50000,
});

/** docs/pricing.md — lưu kho box/day theo box type */
export const STORAGE_BOX_DAY_PRICE_BY_BOX_TYPE = Object.freeze({
  SMALL: 10000,
  MEDIUM: 20000,
  LARGE: 35000,
  EXTRA: 50000,
});

export const HANDLING_UNIT_FALLBACK_PRICE = 10000;

/** Mẫu contract_items khi tạo hợp đồng mới. */
export function buildDefaultContractItemRows(contractId) {
  const rows = [];

  for (const boxType of BOX_TYPE) {
    rows.push({
      contractId,
      itemType: 'INBOUND',
      billingUnit: 'INBOUND_LPN',
      boxType,
      unitPrice: INBOUND_LPN_PRICE_BY_BOX_TYPE[boxType],
    });
    rows.push({
      contractId,
      itemType: 'STORAGE',
      storageLevel: 'BIN',
      billingUnit: 'BOX_DAY',
      boxType,
      unitPrice: STORAGE_BOX_DAY_PRICE_BY_BOX_TYPE[boxType],
    });
  }

  rows.push({
    contractId,
    itemType: 'HANDLING',
    billingUnit: 'HANDLING_UNIT',
    unitPrice: HANDLING_UNIT_FALLBACK_PRICE,
  });

  return rows;
}
