import defineModel from './defineModel.js';

export const warehouseSchema = {
  warehouseId: {
    type: 'string',
    primaryKey: true,
  },
  warehouseCode: {
    type: 'string',
    required: false,
    unique: true,
  },
  warehouseName: {
    type: 'string',
    required: false,
  },
  address: {
    type: 'string',
    required: false,
  },
  totalAreaM2: {
    type: 'decimal',
    required: false,
  },
  status: {
    type: 'string',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'warehouses';

const Warehouse = defineModel(tableName, warehouseSchema);

export { Warehouse };
export default Warehouse;
