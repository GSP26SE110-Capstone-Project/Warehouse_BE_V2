import defineModel from './defineModel.js';

export const storageUsageSnapshotSchema = {
  snapshotId: {
    type: 'string',
    primaryKey: true,
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
  },
  contractId: {
    type: 'string',
    required: true,
    foreignKey: 'contract_id',
  },
  snapshotDate: {
    type: 'date',
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
  boxType: {
    type: 'string',
    required: false,
  },
  occupiedCount: {
    type: 'number',
    required: true,
  },
  calculatedFee: {
    type: 'decimal',
    required: true,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'storage_usage_snapshots';

const StorageUsageSnapshot = defineModel(tableName, storageUsageSnapshotSchema);

export { StorageUsageSnapshot };
export default StorageUsageSnapshot;
