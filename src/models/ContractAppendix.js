import defineModel from './defineModel.js';

export const contractAppendixSchema = {
  appendixId: {
    type: 'string',
    primaryKey: true,
  },
  contractId: {
    type: 'string',
    required: true,
    foreignKey: 'contract_id',
  },
  appendixCode: {
    type: 'string',
    required: true,
    unique: true,
  },
  appendixNumber: {
    type: 'number',
    required: false,
  },
  title: {
    type: 'string',
    required: false,
  },
  status: {
    type: 'string',
    required: false,
  },
  effectiveDate: {
    type: 'date',
    required: true,
  },
  endDate: {
    type: 'date',
    required: true,
  },
  estimatedDeltaAmount: {
    type: 'decimal',
    required: true,
  },
  maxStorageLevel: {
    type: 'string',
    required: false,
  },
  requestedBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
  },
  requestedStorageLevel: {
    type: 'string',
    required: false,
  },
  rejectionReason: {
    type: 'string',
    required: false,
  },
  reviewNote: {
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
  tenantSignature: {
    type: 'string',
    required: false,
  },
  warehouseSignature: {
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
  terminatedAt: {
    type: 'datetime',
    required: false,
  },
  terminationReason: {
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

export const tableName = 'contract_appendices';

const ContractAppendix = defineModel(tableName, contractAppendixSchema);

export { ContractAppendix };
export default ContractAppendix;
