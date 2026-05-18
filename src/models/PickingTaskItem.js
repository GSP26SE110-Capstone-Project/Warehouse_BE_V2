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
    required: false,
    foreignKey: 'inventory_id',
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
