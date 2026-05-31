import defineModel from './defineModel.js';

export const sizeFactorCatalogSchema = {
  sizeGroup: {
    type: 'string',
    primaryKey: true,
    required: true,
    maxLength: 20,
  },
  displayLabel: {
    type: 'string',
    required: true,
    maxLength: 50,
  },
  factor: {
    type: 'number',
    required: true,
  },
  sizes: {
    type: 'json',
    required: true,
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

export const tableName = 'size_factor_catalog';

const SizeFactorCatalog = defineModel(tableName, sizeFactorCatalogSchema);

export { SizeFactorCatalog };
export default SizeFactorCatalog;
