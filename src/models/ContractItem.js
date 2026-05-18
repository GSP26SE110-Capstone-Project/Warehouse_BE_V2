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
    required: false,
  },
  storageLevel: {
    type: 'string',
    required: false,
  },
  quantity: {
    type: 'decimal',
    required: false,
  },
  unitPrice: {
    type: 'decimal',
    required: false,
  },
  billingType: {
    type: 'string',
    required: false,
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
