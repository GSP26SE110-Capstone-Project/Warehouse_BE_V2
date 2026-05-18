import defineModel from './defineModel.js';

export const roleSchema = {
  roleId: {
    type: 'string',
    primaryKey: true,
  },
  roleName: {
    type: 'string',
    required: true,
    unique: true,
  },
};

export const tableName = 'roles';

const Role = defineModel(tableName, roleSchema);

export { Role };
export default Role;
