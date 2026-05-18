import defineModel from './defineModel.js';

export const shipmentSchema = {
  shipmentId: {
    type: 'string',
    primaryKey: true,
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
  },
  outboundRequestId: {
    type: 'string',
    required: true,
    foreignKey: 'outbound_request_id',
  },
  shipmentCode: {
    type: 'string',
    required: false,
    unique: true,
  },
  carrierName: {
    type: 'string',
    required: false,
  },
  trackingNumber: {
    type: 'string',
    required: false,
  },
  status: {
    type: 'string',
    required: false,
  },
  shippedAt: {
    type: 'datetime',
    required: false,
  },
  deliveredAt: {
    type: 'datetime',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
  updatedAt: {
    type: 'datetime',
    required: false,
  },
};

export const tableName = 'shipments';

const Shipment = defineModel(tableName, shipmentSchema);

export { Shipment };
export default Shipment;
