import defineModel from './defineModel.js';

export const userSchema = {
  userId: {
    type: 'string',
    primaryKey: true,
  },
  fullName: {
    type: 'string',
    required: false,
  },
  email: {
    type: 'string',
    required: true,
    unique: true,
  },
  passwordHash: {
    type: 'string',
    required: true,
  },
  phone: {
    type: 'string',
    required: false,
  },
  tenantId: {
    type: 'string',
    required: false,
    foreignKey: 'tenant_id',
  },
  warehouseId: {
    type: 'string',
    required: false,
    foreignKey: 'warehouse_id',
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
    default: 'NOW()',
  },
};

export const tableName = 'users';

const User = defineModel(tableName, userSchema);

export { User };
export default User;
