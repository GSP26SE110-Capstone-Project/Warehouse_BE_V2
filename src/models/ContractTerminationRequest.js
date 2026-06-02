import defineModel from './defineModel.js';

export const contractTerminationRequestSchema = {
  terminationRequestId: {
    type: 'string',
    primaryKey: true,
  },
  contractId: {
    type: 'string',
    required: true,
    foreignKey: 'contract_id',
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
  },
  requestedBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
  },
  status: {
    type: 'string',
    required: false,
  },
  billingCycle: {
    type: 'string',
    required: true,
  },
  hasInbound: {
    type: 'boolean',
    required: true,
  },
  totalPaid: {
    type: 'decimal',
    required: false,
  },
  monthlyRate: {
    type: 'decimal',
    required: false,
  },
  contractMonths: {
    type: 'number',
    required: false,
  },
  usedMonths: {
    type: 'number',
    required: false,
  },
  unusedMonths: {
    type: 'number',
    required: false,
  },
  processingFee: {
    type: 'decimal',
    required: false,
  },
  terminationFee: {
    type: 'decimal',
    required: false,
  },
  refundAmount: {
    type: 'decimal',
    required: false,
  },
  reason: {
    type: 'string',
    required: false,
  },
  reviewedBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
  },
  reviewedAt: {
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

export const tableName = 'contract_termination_requests';

const ContractTerminationRequest = defineModel(
  tableName,
  contractTerminationRequestSchema
);

export { ContractTerminationRequest };
export default ContractTerminationRequest;
