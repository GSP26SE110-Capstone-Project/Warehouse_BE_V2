import defineModel from './defineModel.js';

export const occupancySnapshotSchema = {
  occupancySnapshotId: {
    type: 'string',
    primaryKey: true,
  },
  warehouseId: {
    type: 'string',
    required: false,
    foreignKey: 'warehouse_id',
  },
  snapshotDate: {
    type: 'date',
    required: false,
  },
  occupancyRate: {
    type: 'decimal',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'occupancy_snapshots';

const OccupancySnapshot = defineModel(tableName, occupancySnapshotSchema);

export { OccupancySnapshot };
export default OccupancySnapshot;
