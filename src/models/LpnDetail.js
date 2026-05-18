import defineModel from './defineModel.js';

export const lpnDetailSchema = {
  lpnDetailId: {
    type: 'string',
    primaryKey: true,
  },
  lpnId: {
    type: 'string',
    required: true,
    foreignKey: 'lpn_id',
  },
  skuId: {
    type: 'string',
    required: true,
    foreignKey: 'sku_id',
  },
  quantity: {
    type: 'number',
    required: true,
  },
};

export const tableName = 'lpn_details';

const LpnDetail = defineModel(tableName, lpnDetailSchema);

export { LpnDetail };
export default LpnDetail;
