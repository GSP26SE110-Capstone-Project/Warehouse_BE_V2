import ContractItem from '../models/ContractItem.js';
import { buildDefaultContractItemRows } from '../constants/pricingDefaults.js';

/**
 * Seed đơn giá mặc định (docs/pricing.md) khi tạo hợp đồng.
 * Bỏ qua nếu contract đã có item.
 */
export async function seedDefaultContractItems(contractId) {
  const existing = await ContractItem.findAll({ contractId });
  if (existing.length > 0) {
    return { seeded: 0, skipped: true };
  }

  const rows = buildDefaultContractItemRows(contractId);
  let seeded = 0;
  for (const row of rows) {
    await ContractItem.create(row);
    seeded += 1;
  }
  return { seeded, skipped: false };
}
