import defineModel from './defineModel.js';

export const inventoryMovementSchema = {
  movementId: {
    type: 'string',
    primaryKey: true,
  },
  inventoryId: {
    type: 'string',
    required: true,
    foreignKey: 'inventory_id',
  },
  movementType: {
    type: 'string',
    required: true,
  },
  fromBinId: {
    type: 'string',
    required: false,
    foreignKey: 'bin_id',
  },
  toBinId: {
    type: 'string',
    required: false,
    foreignKey: 'bin_id',
  },
  quantity: {
    type: 'number',
    required: true,
  },
  movedBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
  },
  movedAt: {
    type: 'datetime',
    required: false,
  },
  note: {
    type: 'string',
    required: false,
  },
};

export const tableName = 'inventory_movements';

const InventoryMovement = defineModel(tableName, inventoryMovementSchema);

export { InventoryMovement };
export default InventoryMovement;
