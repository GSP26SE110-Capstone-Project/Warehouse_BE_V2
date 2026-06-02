import defineModel from './defineModel.js';

export const inboundDeliverySchema = {
  inboundDeliveryId: {
    type: 'string',
    primaryKey: true,
  },
  inboundRequestId: {
    type: 'string',
    required: true,
    foreignKey: 'inbound_request_id',
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
  scheduledAt: {
    type: 'datetime',
    required: false,
  },
  notes: {
    type: 'string',
    required: false,
  },
  pickupAddress: {
    type: 'string',
    required: false,
  },
  pickupContactName: {
    type: 'string',
    required: false,
  },
  pickupContactPhone: {
    type: 'string',
    required: false,
  },
  pickupNotes: {
    type: 'string',
    required: false,
  },
  assignedDriverUserId: {
    type: 'string',
    required: false,
    foreignKey: 'assigned_driver_user_id',
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

export const tableName = 'inbound_deliveries';

const InboundDelivery = defineModel(tableName, inboundDeliverySchema);

export { InboundDelivery };
export default InboundDelivery;
