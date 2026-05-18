import defineModel from './defineModel.js';

export const categorySchema = {
  categoryId: {
    type: 'string',
    primaryKey: true,
  },
  categoryName: {
    type: 'string',
    required: true,
  },
};

export const tableName = 'categories';

const Category = defineModel(tableName, categorySchema);

export { Category };
export default Category;
