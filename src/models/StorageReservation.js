import defineModel from './defineModel.js';

export const storageReservationSchema = {
  reservationId: {
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
  reservationType: {
    type: 'string',
    required: true,
  },
  storageLevel: {
    type: 'string',
    required: true,
  },
  warehouseId: {
    type: 'string',
    required: true,
    foreignKey: 'warehouse_id',
  },
  zoneId: {
    type: 'string',
    required: false,
    foreignKey: 'zone_id',
  },
  rackId: {
    type: 'string',
    required: false,
    foreignKey: 'rack_id',
  },
  rackLevelId: {
    type: 'string',
    required: false,
    foreignKey: 'rack_level_id',
  },
  binId: {
    type: 'string',
    required: false,
    foreignKey: 'bin_id',
  },
  reservedCapacity: {
    type: 'decimal',
    required: false,
  },
  boxType: {
    type: 'string',
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
  status: {
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

export const tableName = 'storage_reservations';

const StorageReservation = defineModel(tableName, storageReservationSchema);

export { StorageReservation };
export default StorageReservation;
