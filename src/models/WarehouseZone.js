import defineModel from './defineModel.js';

export const warehouseZoneSchema = {
  zoneId: {
    type: 'string',
    primaryKey: true,
  },
  warehouseId: {
    type: 'string',
    required: true,
    foreignKey: 'warehouse_id',
  },
  zoneCode: {
    type: 'string',
    required: false,
  },
  zoneName: {
    type: 'string',
    required: false,
  },
  zoneType: {
    type: 'string',
    required: false,
  },
  areaM2: {
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

export const tableName = 'warehouse_zones';

const WarehouseZone = defineModel(tableName, warehouseZoneSchema);

export { WarehouseZone };
export default WarehouseZone;
