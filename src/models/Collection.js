import defineModel from './defineModel.js';

export const collectionSchema = {
  collectionId: {
    type: 'string',
    primaryKey: true,
  },
  collectionName: {
    type: 'string',
    required: false,
  },
};

export const tableName = 'collections';

const Collection = defineModel(tableName, collectionSchema);

export { Collection };
export default Collection;
