import defineModel from './defineModel.js';

export const pricingPolicySchema = {
  pricingPolicyId: {
    type: 'string',
    primaryKey: true,
  },
  warehouseId: {
    type: 'string',
    required: false,
    foreignKey: 'warehouse_id',
  },
  contractType: {
    type: 'string',
    required: false,
  },
  storageLevel: {
    type: 'string',
    required: false,
  },
  billingUnit: {
    type: 'string',
    required: true,
  },
  boxType: {
    type: 'string',
    required: false,
  },
  price: {
    type: 'decimal',
    required: true,
  },
  effectiveFrom: {
    type: 'datetime',
    required: false,
  },
  effectiveTo: {
    type: 'datetime',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'pricing_policies';

const PricingPolicy = defineModel(tableName, pricingPolicySchema);

export { PricingPolicy };
export default PricingPolicy;
