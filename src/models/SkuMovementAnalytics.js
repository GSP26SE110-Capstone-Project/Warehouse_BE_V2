import defineModel from './defineModel.js';

export const skuMovementAnalyticsSchema = {
  analyticsId: {
    type: 'string',
    primaryKey: true,
  },
  skuId: {
    type: 'string',
    required: false,
    foreignKey: 'sku_id',
  },
  snapshotDate: {
    type: 'date',
    required: false,
  },
  inboundQty: {
    type: 'number',
    required: false,
  },
  outboundQty: {
    type: 'number',
    required: false,
  },
  pickingCount: {
    type: 'number',
    required: false,
  },
  averageStorageDays: {
    type: 'decimal',
    required: false,
  },
  turnoverScore: {
    type: 'decimal',
    required: false,
  },
  movementCategory: {
    type: 'string',
    required: false,
  },
};

export const tableName = 'sku_movement_analytics';

const SkuMovementAnalytics = defineModel(tableName, skuMovementAnalyticsSchema);

export { SkuMovementAnalytics };
export default SkuMovementAnalytics;
