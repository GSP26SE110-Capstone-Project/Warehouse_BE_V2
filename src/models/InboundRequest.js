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
  warehouseId: {
    type: 'string',
    required: true,
    foreignKey: 'warehouse_id',
  },
  inboundCode: {
    type: 'string',
    required: true,
    unique: true,
  },
  expectedArrivalDate: {
    type: 'datetime',
    required: false,
  },
  actualArrivalAt: {
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
  approvedBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
  },
  receivedBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
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

export const tableName = 'inbound_requests';

const InboundRequest = defineModel(tableName, inboundRequestSchema);

export { InboundRequest };
export default InboundRequest;
