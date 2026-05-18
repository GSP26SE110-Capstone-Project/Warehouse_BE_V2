import defineModel from './defineModel.js';

export const contractSchema = {
  contractId: {
    type: 'string',
    primaryKey: true,
  },
  contractCode: {
    type: 'string',
    required: false,
    unique: true,
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
    unique: true,
    foreignKey: 'rental_request_id',
  },
  contractName: {
    type: 'string',
    required: false,
  },
  contractType: {
    type: 'string',
    required: false,
  },
  pricingModel: {
    type: 'string',
    required: false,
  },
  startDate: {
    type: 'datetime',
    required: false,
  },
  endDate: {
    type: 'datetime',
    required: false,
  },
  billingCycle: {
    type: 'string',
    required: false,
  },
  autoRenew: {
    type: 'boolean',
    required: false,
  },
  minimumReservedCapacity: {
    type: 'decimal',
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
  tenantSignature: {
    type: 'string',
    required: false,
  },
  warehouseSignature: {
    type: 'string',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'contracts';

const Contract = defineModel(tableName, contractSchema);

export { Contract };
export default Contract;
