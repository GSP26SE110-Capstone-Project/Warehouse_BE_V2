import defineModel from './defineModel.js';

export const paymentSchema = {
  paymentId: {
    type: 'string',
    primaryKey: true,
  },
  invoiceId: {
    type: 'string',
    required: true,
    foreignKey: 'invoice_id',
  },
  amount: {
    type: 'decimal',
    required: true,
  },
  paymentMethod: {
    type: 'string',
    required: false,
  },
  paymentStatus: {
    type: 'string',
    required: false,
  },
  transactionCode: {
    type: 'string',
    required: false,
  },
  paidAt: {
    type: 'datetime',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'payments';

const Payment = defineModel(tableName, paymentSchema);

export { Payment };
export default Payment;
