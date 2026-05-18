import defineModel from './defineModel.js';

export const warehouseSchema = {
  warehouseId: {
    type: 'string',
    primaryKey: true,
  },
  warehouseCode: {
    type: 'string',
    required: true,
    unique: true,
  },
  warehouseName: {
    type: 'string',
    required: true,
  },
  address: {
    type: 'string',
    required: false,
  },
  totalAreaM2: {
    type: 'decimal',
    required: false,
  },
  usableAreaM2: {
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
  updatedAt: {
    type: 'datetime',
    required: false,
  },
};

export const tableName = 'warehouses';

const Warehouse = defineModel(tableName, warehouseSchema);

export { Warehouse };
export default Warehouse;
