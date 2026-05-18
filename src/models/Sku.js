import defineModel from './defineModel.js';

export const skuSchema = {
  skuId: {
    type: 'string',
    primaryKey: true,
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
  },
  skuCode: {
    type: 'string',
    required: false,
    unique: true,
  },
  productName: {
    type: 'string',
    required: false,
  },
  categoryId: {
    type: 'string',
    required: false,
    foreignKey: 'category_id',
  },
  collectionId: {
    type: 'string',
    required: false,
    foreignKey: 'collection_id',
  },
  seasonId: {
    type: 'string',
    required: false,
    foreignKey: 'season_id',
  },
  color: {
    type: 'string',
    required: false,
  },
  size: {
    type: 'string',
    required: false,
  },
  material: {
    type: 'string',
    required: false,
  },
  boxType: {
    type: 'string',
    required: false,
  },
  status: {
    type: 'string',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'skus';

const Sku = defineModel(tableName, skuSchema);

export { Sku };
export default Sku;
