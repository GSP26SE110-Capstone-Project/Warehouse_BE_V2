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
    required: true,
  },
  supportedBoxType: {
    type: 'string',
    required: false,
  },
  maxLpnCount: {
    type: 'number',
    required: true,
  },
  currentLpnCount: {
    type: 'number',
    required: false,
  },
  maxVolumeUnits: {
    type: 'number',
    required: true,
  },
  usedVolumeUnits: {
    type: 'number',
    required: false,
  },
  maxOwnerCount: {
    type: 'number',
    required: false,
  },
  reservationType: {
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
  updatedAt: {
    type: 'datetime',
    required: false,
  },
};

export const tableName = 'bins';

const Bin = defineModel(tableName, binSchema);

export { Bin };
export default Bin;
