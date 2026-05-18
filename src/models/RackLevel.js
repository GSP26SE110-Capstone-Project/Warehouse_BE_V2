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
  levelCode: {
    type: 'string',
    required: false,
  },
  levelNumber: {
    type: 'number',
    required: true,
  },
  maxBins: {
    type: 'number',
    required: false,
  },
  maxWeightKg: {
    type: 'decimal',
    required: false,
  },
  heightCm: {
    type: 'decimal',
    required: false,
  },
  levelPriority: {
    type: 'number',
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

export const tableName = 'rack_levels';

const RackLevel = defineModel(tableName, rackLevelSchema);

export { RackLevel };
export default RackLevel;
