import defineModel from './defineModel.js';

export const binSchema = {
  binId: {
    type: 'string',
    primaryKey: true,
  },
  rackLevelId: {
    type: 'string',
    required: true,
    foreignKey: 'rack_level_id',
  },
  binCode: {
    type: 'string',
    required: false,
  },
  capacitySmall: {
    type: 'decimal',
    required: false,
  },
  capacityMedium: {
    type: 'decimal',
    required: false,
  },
  capacityLarge: {
    type: 'decimal',
    required: false,
  },
  capacityExtra: {
    type: 'decimal',
    required: false,
  },
  currentOccupiedCapacity: {
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

export const tableName = 'bins';

const Bin = defineModel(tableName, binSchema);

export { Bin };
export default Bin;
