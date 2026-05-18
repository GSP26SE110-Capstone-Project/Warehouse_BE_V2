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
    required: false,
  },
  rackType: {
    type: 'string',
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

export const tableName = 'racks';

const Rack = defineModel(tableName, rackSchema);

export { Rack };
export default Rack;
