import defineModel from './defineModel.js';

export const rackLevelSchema = {
  rackLevelId: {
    type: 'string',
    primaryKey: true,
  },
  rackId: {
    type: 'string',
    required: true,
    foreignKey: 'rack_id',
  },
  levelNumber: {
    type: 'number',
    required: false,
  },
  maxBins: {
    type: 'number',
    required: false,
  },
  maxWeight: {
    type: 'decimal',
    required: false,
  },
  heightCm: {
    type: 'decimal',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'rack_levels';

const RackLevel = defineModel(tableName, rackLevelSchema);

export { RackLevel };
export default RackLevel;
