import defineModel from './defineModel.js';

export const invoiceSchema = {
  invoiceId: {
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
  invoiceCode: {
    type: 'string',
    required: false,
    unique: true,
  },
  billingPeriodStart: {
    type: 'datetime',
    required: false,
  },
  billingPeriodEnd: {
    type: 'datetime',
    required: false,
  },
  subtotal: {
    type: 'decimal',
    required: false,
  },
  tax: {
    type: 'decimal',
    required: false,
  },
  totalAmount: {
    type: 'decimal',
    required: false,
  },
  paymentStatus: {
    type: 'string',
    required: false,
  },
  issuedAt: {
    type: 'datetime',
    required: false,
  },
  dueDate: {
    type: 'datetime',
    required: false,
  },
};

export const tableName = 'invoices';

const Invoice = defineModel(tableName, invoiceSchema);

export { Invoice };
export default Invoice;
