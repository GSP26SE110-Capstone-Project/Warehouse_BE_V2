import defineModel from './defineModel.js';

export const pickingTaskItemSchema = {
  pickingTaskItemId: {
    type: 'string',
    primaryKey: true,
  },
  pickingTaskId: {
    type: 'string',
    required: true,
    foreignKey: 'picking_task_id',
  },
  inventoryId: {
    type: 'string',
    required: true,
    foreignKey: 'inventory_id',
  },
  lpnId: {
    type: 'string',
    required: true,
    foreignKey: 'lpn_id',
  },
  binId: {
    type: 'string',
    required: true,
    foreignKey: 'bin_id',
  },
  batchId: {
    type: 'string',
    required: true,
    foreignKey: 'batch_id',
  },
  quantityToPick: {
    type: 'number',
    required: true,
  },
  pickedQuantity: {
    type: 'number',
    required: false,
  },
};

export const tableName = 'picking_task_items';

const PickingTaskItem = defineModel(tableName, pickingTaskItemSchema);

export { PickingTaskItem };
export default PickingTaskItem;
