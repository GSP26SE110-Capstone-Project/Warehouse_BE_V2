import defineModel from './defineModel.js';

export const rentalRequestSchema = {
  rentalRequestId: {
    type: 'string',
    primaryKey: true,
  },
  requestCode: {
    type: 'string',
    required: false,
    unique: true,
  },
  companyName: {
    type: 'string',
    required: false,
  },
  companyCode: {
    type: 'string',
    required: false,
  },
  taxCode: {
    type: 'string',
    required: false,
  },
  address: {
    type: 'string',
    required: false,
  },
  contactName: {
    type: 'string',
    required: false,
  },
  contactPhone: {
    type: 'string',
    required: false,
  },
  contactEmail: {
    type: 'string',
    required: false,
  },
  warehouseId: {
    type: 'string',
    required: true,
    foreignKey: 'warehouse_id',
  },
  contractType: {
    type: 'string',
    required: false,
  },
  pricingModel: {
    type: 'string',
    required: false,
  },
  billingCycle: {
    type: 'string',
    required: false,
  },
  requestedCapacity: {
    type: 'decimal',
    required: false,
  },
  notes: {
    type: 'string',
    required: false,
  },
  status: {
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
  rejectionReason: {
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
  updatedAt: {
    type: 'datetime',
    required: false,
  },
};

export const tableName = 'rental_requests';

const RentalRequest = defineModel(tableName, rentalRequestSchema);

export { RentalRequest };
export default RentalRequest;
