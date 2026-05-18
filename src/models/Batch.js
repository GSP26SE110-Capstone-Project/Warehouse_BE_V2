import defineModel from './defineModel.js';

export const batchSchema = {
  batchId: {
    type: 'string',
    primaryKey: true,
  },
  inboundRequestId: {
    type: 'string',
    required: true,
    foreignKey: 'inbound_request_id',
  },
  batchCode: {
    type: 'string',
    required: true,
    unique: true,
  },
  warehouseReceivedAt: {
    type: 'datetime',
    required: true,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'batches';

const Batch = defineModel(tableName, batchSchema);

export { Batch };
export default Batch;
