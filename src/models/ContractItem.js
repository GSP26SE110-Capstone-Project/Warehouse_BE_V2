import defineModel from './defineModel.js';

export const contractItemSchema = {
  contractItemId: {
    type: 'string',
    primaryKey: true,
  },
  contractId: {
    type: 'string',
    required: true,
    foreignKey: 'contract_id',
  },
  itemType: {
    type: 'string',
    required: true,
  },
  storageLevel: {
    type: 'string',
    required: false,
  },
  billingUnit: {
    type: 'string',
    required: true,
  },
  quantity: {
    type: 'decimal',
    required: false,
  },
  reservedQuantity: {
    type: 'number',
    required: false,
  },
  boxType: {
    type: 'string',
    required: false,
  },
  unitPrice: {
    type: 'decimal',
    required: true,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'contract_items';

const ContractItem = defineModel(tableName, contractItemSchema);

export { ContractItem };
export default ContractItem;
