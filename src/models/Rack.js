import defineModel from './defineModel.js';

export const rackSchema = {
  rackId: {
    type: 'string',
    primaryKey: true,
  },
  zoneId: {
    type: 'string',
    required: true,
    foreignKey: 'zone_id',
  },
  rackCode: {
    type: 'string',
    required: true,
  },
  rackType: {
    type: 'string',
    required: false,
  },
  maxLevels: {
    type: 'number',
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

export const tableName = 'racks';

const Rack = defineModel(tableName, rackSchema);

export { Rack };
export default Rack;
