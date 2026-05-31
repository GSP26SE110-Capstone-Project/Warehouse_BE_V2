import defineModel from './defineModel.js';

export const productKindCatalogSchema = {
  productKind: {
    type: 'string',
    primaryKey: true,
    required: true,
    maxLength: 50,
  },
  groupCode: {
    type: 'string',
    required: true,
    maxLength: 50,
  },
  displayName: {
    type: 'string',
    required: true,
    maxLength: 100,
  },
  baseVolumeUnitsPerPiece: {
    type: 'number',
    required: true,
  },
  hasSize: {
    type: 'boolean',
    default: true,
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

export const tableName = 'product_kind_catalog';

const ProductKindCatalog = defineModel(tableName, productKindCatalogSchema);

export { ProductKindCatalog };
export default ProductKindCatalog;
