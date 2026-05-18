import defineModel from './defineModel.js';

export const shipmentSchema = {
  shipmentId: {
    type: 'string',
    primaryKey: true,
  },
  outboundRequestId: {
    type: 'string',
    required: false,
    foreignKey: 'outbound_request_id',
  },
  shipmentCode: {
    type: 'string',
    required: false,
  },
  shippedAt: {
    type: 'datetime',
    required: false,
  },
  status: {
    type: 'string',
    required: false,
  },
};

export const tableName = 'shipments';

const Shipment = defineModel(tableName, shipmentSchema);

export { Shipment };
export default Shipment;
