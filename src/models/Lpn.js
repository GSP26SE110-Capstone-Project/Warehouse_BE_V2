import defineModel from './defineModel.js';

export const lpnSchema = {
  lpnId: {
    type: 'string',
    primaryKey: true,
  },
  batchId: {
    type: 'string',
    required: false,
    foreignKey: 'batch_id',
  },
  lpnCode: {
    type: 'string',
    required: false,
    unique: true,
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
  },
  boxType: {
    type: 'string',
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
};

export const tableName = 'lpns';

const Lpn = defineModel(tableName, lpnSchema);

export { Lpn };
export default Lpn;
