import defineModel from './defineModel.js';

export const outboundDeliverySchema = {
  outboundDeliveryId: {
    type: 'string',
    primaryKey: true,
  },
  outboundRequestId: {
    type: 'string',
    required: true,
    foreignKey: 'outbound_request_id',
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
  },
  vehiclePlate: {
    type: 'string',
    required: false,
  },
  driverName: {
    type: 'string',
    required: false,
  },
  driverPhone: {
    type: 'string',
    required: false,
  },
  driverIdNumber: {
    type: 'string',
    required: false,
  },
  carrierName: {
    type: 'string',
    required: false,
  },
  shipToAddress: {
    type: 'string',
    required: false,
  },
  shipToContactName: {
    type: 'string',
    required: false,
  },
  shipToContactPhone: {
    type: 'string',
    required: false,
  },
  shipToNotes: {
    type: 'string',
    required: false,
  },
  assignedDriverUserId: {
    type: 'string',
    required: false,
    foreignKey: 'assigned_driver_user_id',
  },
  deliveryStatus: {
    type: 'string',
    required: false,
  },
  actualPickupAt: {
    type: 'datetime',
    required: false,
  },
  actualDeliveredAt: {
    type: 'datetime',
    required: false,
  },
  notes: {
    type: 'string',
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

export const tableName = 'outbound_deliveries';

const OutboundDelivery = defineModel(tableName, outboundDeliverySchema);

export { OutboundDelivery };
export default OutboundDelivery;
