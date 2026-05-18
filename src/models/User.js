import defineModel from './defineModel.js';

export const userSchema = {
  userId: {
    type: 'string',
    primaryKey: true,
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
  fullName: {
    type: 'string',
    required: true,
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
  role: {
    type: 'string',
    required: true,
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

export const tableName = 'users';

const User = defineModel(tableName, userSchema);

export { User };
export default User;
