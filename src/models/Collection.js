import defineModel from './defineModel.js';

export const collectionSchema = {
  collectionId: {
    type: 'string',
    primaryKey: true,
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
  },
  collectionName: {
    type: 'string',
    required: true,
  },
};

export const tableName = 'collections';

const Collection = defineModel(tableName, collectionSchema);

export { Collection };
export default Collection;
