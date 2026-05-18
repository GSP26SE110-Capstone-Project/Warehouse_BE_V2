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
  paymentMethod: {
    type: 'string',
    required: false,
  },
  amount: {
    type: 'decimal',
    required: false,
  },
  paymentStatus: {
    type: 'string',
    required: false,
  },
  paidAt: {
    type: 'datetime',
    required: false,
  },
};

export const tableName = 'payments';

const Payment = defineModel(tableName, paymentSchema);

export { Payment };
export default Payment;
