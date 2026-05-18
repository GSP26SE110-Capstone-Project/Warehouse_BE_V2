import defineModel from './defineModel.js';

export const outboundRequestSchema = {
  outboundRequestId: {
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
  requestedShipDate: {
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

export const tableName = 'outbound_requests';

const OutboundRequest = defineModel(tableName, outboundRequestSchema);

export { OutboundRequest };
export default OutboundRequest;
