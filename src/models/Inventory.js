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
    required: false,
    foreignKey: 'batch_id',
  },
  lpnId: {
    type: 'string',
    required: false,
    foreignKey: 'lpn_id',
  },
  binId: {
    type: 'string',
    required: false,
    foreignKey: 'bin_id',
  },
  quantity: {
    type: 'number',
    required: false,
  },
  inventoryStatus: {
    type: 'string',
    required: false,
  },
  receivedAt: {
    type: 'datetime',
    required: false,
  },
  updatedAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'inventories';

const Inventory = defineModel(tableName, inventorySchema);

export { Inventory };
export default Inventory;
