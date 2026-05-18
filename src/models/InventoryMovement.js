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
  movementType: {
    type: 'string',
    required: false,
  },
  quantity: {
    type: 'number',
    required: false,
  },
  createdBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'inventory_movements';

const InventoryMovement = defineModel(tableName, inventoryMovementSchema);

export { InventoryMovement };
export default InventoryMovement;
