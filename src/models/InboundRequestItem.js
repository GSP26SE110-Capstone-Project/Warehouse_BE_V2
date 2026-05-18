import defineModel from './defineModel.js';

export const inboundRequestItemSchema = {
  inboundRequestItemId: {
    type: 'string',
    primaryKey: true,
  },
  inboundRequestId: {
    type: 'string',
    required: true,
    foreignKey: 'inbound_request_id',
  },
  skuId: {
    type: 'string',
    required: true,
    foreignKey: 'sku_id',
  },
  expectedQuantity: {
    type: 'number',
    required: true,
  },
  receivedQuantity: {
    type: 'number',
    required: false,
  },
  discrepancyQuantity: {
    type: 'number',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'inbound_request_items';

const InboundRequestItem = defineModel(tableName, inboundRequestItemSchema);

export { InboundRequestItem };
export default InboundRequestItem;
