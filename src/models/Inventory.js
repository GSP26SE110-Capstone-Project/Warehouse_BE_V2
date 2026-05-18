import defineModel from './defineModel.js';

export const inventorySchema = {
  inventoryId: {
    type: 'string',
    primaryKey: true,
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
  },
  skuId: {
    type: 'string',
    required: true,
    foreignKey: 'sku_id',
  },
  batchId: {
    type: 'string',
    required: true,
    foreignKey: 'batch_id',
  },
  lpnId: {
    type: 'string',
    required: true,
    foreignKey: 'lpn_id',
  },
  binId: {
    type: 'string',
    required: true,
    foreignKey: 'bin_id',
  },
  quantity: {
    type: 'number',
    required: true,
  },
  reservedQuantity: {
    type: 'number',
    required: false,
  },
  availableQuantity: {
    type: 'number',
    required: false,
  },
  status: {
    type: 'string',
    required: false,
  },
  receivedAt: {
    type: 'datetime',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
  updatedAt: {
    type: 'datetime',
    required: false,
  },
};

export const tableName = 'inventories';

const Inventory = defineModel(tableName, inventorySchema);

export { Inventory };
export default Inventory;
