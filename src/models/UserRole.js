import defineModel from './defineModel.js';

export const userRoleSchema = {
  userRoleId: {
    type: 'string',
    primaryKey: true,
  },
  userId: {
    type: 'string',
    required: true,
    foreignKey: 'user_id',
  },
  roleId: {
    type: 'string',
    required: true,
    foreignKey: 'role_id',
  },
};

export const tableName = 'user_roles';

const UserRole = defineModel(tableName, userRoleSchema);

export { UserRole };
export default UserRole;
