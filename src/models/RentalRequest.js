import defineModel from './defineModel.js';

export const rentalRequestSchema = {
  rentalRequestId: {
    type: 'string',
    primaryKey: true,
  },
  requestCode: {
    type: 'string',
    required: true,
    unique: true,
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
  },
  city: {
    type: 'string',
    required: true,
    maxLength: 100,
  },
  district: {
    type: 'string',
    required: true,
    maxLength: 100,
  },
  warehouseId: {
    type: 'string',
    required: false,
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
  estimatedSkuCount: {
    type: 'number',
    required: false,
  },
  estimatedBoxCount: {
    type: 'number',
    required: false,
  },
  estimatedVolume: {
    type: 'decimal',
    required: false,
  },
  requestedAreaM2: {
    type: 'decimal',
    required: false,
  },
  averageStorageDays: {
    type: 'number',
    required: false,
  },
  estimatedInboundPerWeek: {
    type: 'number',
    required: false,
  },
  estimatedOutboundPerWeek: {
    type: 'number',
    required: false,
  },
  requiresFastPicking: {
    type: 'boolean',
    default: false,
  },
  requiresPremiumStorage: {
    type: 'boolean',
    default: false,
  },
  notes: {
    type: 'string',
    required: false,
  },
  suggestedZoneType: {
    type: 'string',
    required: false,
  },
  suggestedRackType: {
    type: 'string',
    required: false,
  },
  expectedStartDate: {
    type: 'datetime',
    required: false,
  },
  expectedEndDate: {
    type: 'datetime',
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
  reviewNote: {
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
