import defineModel from './defineModel.js';

export const lpnSchema = {
  lpnId: {
    type: 'string',
    primaryKey: true,
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
  },
  batchId: {
    type: 'string',
    required: true,
    foreignKey: 'batch_id',
  },
  lpnCode: {
    type: 'string',
    required: true,
    unique: true,
  },
  boxType: {
    type: 'string',
    required: true,
  },
  volumeUnits: {
    type: 'number',
    required: true,
  },
  maxCapacity: {
    type: 'number',
    required: false,
  },
  actualQuantity: {
    type: 'number',
    required: false,
  },
  fillPercentage: {
    type: 'decimal',
    required: false,
  },
  currentBinId: {
    type: 'string',
    required: false,
    foreignKey: 'bin_id',
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

export const tableName = 'lpns';

const Lpn = defineModel(tableName, lpnSchema);

export { Lpn };
export default Lpn;
