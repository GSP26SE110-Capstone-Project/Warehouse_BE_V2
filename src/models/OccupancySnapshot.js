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
  zoneId: {
    type: 'string',
    required: false,
    foreignKey: 'zone_id',
  },
  occupancyRate: {
    type: 'decimal',
    required: false,
  },
  availableCapacity: {
    type: 'number',
    required: false,
  },
  snapshotDate: {
    type: 'date',
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
