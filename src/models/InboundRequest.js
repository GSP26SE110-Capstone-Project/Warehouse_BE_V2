import defineModel from './defineModel.js';

export const inboundRequestSchema = {
  inboundRequestId: {
    type: 'string',
    primaryKey: true,
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
  },
  contractId: {
    type: 'string',
    required: true,
    foreignKey: 'contract_id',
  },
  requestCode: {
    type: 'string',
    required: false,
    unique: true,
  },
  expectedArrivalDate: {
    type: 'datetime',
    required: false,
  },
  actualArrivalDate: {
    type: 'datetime',
    required: false,
  },
  status: {
    type: 'string',
    required: false,
  },
  createdBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'inbound_requests';

const InboundRequest = defineModel(tableName, inboundRequestSchema);

export { InboundRequest };
export default InboundRequest;
