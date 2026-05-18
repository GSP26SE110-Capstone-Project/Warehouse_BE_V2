import defineModel from './defineModel.js';

export const pickingTaskSchema = {
  pickingTaskId: {
    type: 'string',
    primaryKey: true,
  },
  outboundRequestId: {
    type: 'string',
    required: false,
    foreignKey: 'outbound_request_id',
  },
  assignedTo: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
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

export const tableName = 'picking_tasks';

const PickingTask = defineModel(tableName, pickingTaskSchema);

export { PickingTask };
export default PickingTask;
