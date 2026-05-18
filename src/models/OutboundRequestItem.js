import defineModel from './defineModel.js';

export const outboundRequestItemSchema = {
  outboundRequestItemId: {
    type: 'string',
    primaryKey: true,
  },
  outboundRequestId: {
    type: 'string',
    required: true,
    foreignKey: 'outbound_request_id',
  },
  skuId: {
    type: 'string',
    required: true,
    foreignKey: 'sku_id',
  },
  requestedQuantity: {
    type: 'number',
    required: true,
  },
  allocatedQuantity: {
    type: 'number',
    required: false,
  },
  pickedQuantity: {
    type: 'number',
    required: false,
  },
};

export const tableName = 'outbound_request_items';

const OutboundRequestItem = defineModel(tableName, outboundRequestItemSchema);

export { OutboundRequestItem };
export default OutboundRequestItem;
