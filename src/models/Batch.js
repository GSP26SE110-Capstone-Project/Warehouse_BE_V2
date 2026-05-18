import defineModel from './defineModel.js';

export const batchSchema = {
  batchId: {
    type: 'string',
    primaryKey: true,
  },
  inboundRequestId: {
    type: 'string',
    required: false,
    foreignKey: 'inbound_request_id',
  },
  batchCode: {
    type: 'string',
    required: false,
  },
  receivedDate: {
    type: 'datetime',
    required: false,
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
