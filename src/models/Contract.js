import defineModel from './defineModel.js';

export const contractSchema = {
  contractId: {
    type: 'string',
    primaryKey: true,
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
  },
  warehouseId: {
    type: 'string',
    required: true,
    foreignKey: 'warehouse_id',
  },
  rentalRequestId: {
    type: 'string',
    required: false,
    foreignKey: 'rental_request_id',
    unique: true,
  },
  contractCode: {
    type: 'string',
    required: true,
    unique: true,
  },
  contractName: {
    type: 'string',
    required: false,
  },
  contractType: {
    type: 'string',
    required: true,
  },
  pricingModel: {
    type: 'string',
    required: true,
  },
  billingCycle: {
    type: 'string',
    required: false,
  },
  allowDynamicRelocation: {
    type: 'boolean',
    required: false,
  },
  autoRenew: {
    type: 'boolean',
    required: false,
  },
  startDate: {
    type: 'date',
    required: true,
  },
  endDate: {
    type: 'date',
    required: true,
  },
  minimumBillingDays: {
    type: 'number',
    required: false,
  },
  minimumReservedCapacity: {
    type: 'decimal',
    required: false,
  },
  estimatedTotalAmount: {
    type: 'decimal',
    required: false,
  },
  status: {
    type: 'string',
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
  activatedAt: {
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

export const tableName = 'contracts';

const Contract = defineModel(tableName, contractSchema);

export { Contract };
export default Contract;
