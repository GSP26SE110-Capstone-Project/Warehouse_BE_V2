import defineModel from './defineModel.js';

export const rentalRequestProductLineSchema = {
  lineId: {
    type: 'string',
    primaryKey: true,
  },
  rentalRequestId: {
    type: 'string',
    required: true,
    foreignKey: 'rental_request_id',
  },
  productKind: {
    type: 'string',
    required: true,
    maxLength: 50,
  },
  size: {
    type: 'string',
    required: false,
    maxLength: 50,
  },
  sizeGroup: {
    type: 'string',
    required: false,
    maxLength: 20,
  },
  quantity: {
    type: 'number',
    required: true,
  },
  baseVolumeUnitsPerPiece: {
    type: 'number',
    required: true,
  },
  sizeFactor: {
    type: 'number',
    required: true,
  },
  finalVolumeUnitsPerPiece: {
    type: 'number',
    required: true,
  },
  lineVolumeUnits: {
    type: 'number',
    required: true,
  },
  sortOrder: {
    type: 'number',
    default: 0,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
  updatedAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'rental_request_product_lines';

const RentalRequestProductLine = defineModel(tableName, rentalRequestProductLineSchema);

export { RentalRequestProductLine };
export default RentalRequestProductLine;
