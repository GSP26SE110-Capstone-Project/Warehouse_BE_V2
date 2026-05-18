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
  storageLevel: {
    type: 'string',
    required: false,
  },
  pricingMethod: {
    type: 'string',
    required: false,
  },
  unit: {
    type: 'string',
    required: false,
  },
  boxType: {
    type: 'string',
    required: false,
  },
  price: {
    type: 'decimal',
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
