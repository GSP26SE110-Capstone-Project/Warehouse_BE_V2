import defineModel from './defineModel.js';

export const garmentCategoryGroupSchema = {
  groupCode: {
    type: 'string',
    primaryKey: true,
    required: true,
    maxLength: 50,
  },
  displayNameVi: {
    type: 'string',
    required: true,
    maxLength: 100,
  },
  displayNameEn: {
    type: 'string',
    required: false,
    maxLength: 100,
  },
  sortOrder: {
    type: 'number',
    default: 0,
  },
  status: {
    type: 'string',
    default: 'ACTIVE',
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

export const tableName = 'garment_category_groups';

const GarmentCategoryGroup = defineModel(tableName, garmentCategoryGroupSchema);

export { GarmentCategoryGroup };
export default GarmentCategoryGroup;
