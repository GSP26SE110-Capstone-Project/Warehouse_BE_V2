import defineModel from './defineModel.js';

export const invoiceSchema = {
  invoiceId: {
    type: 'string',
    primaryKey: true,
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
  },
  contractId: {
    type: 'string',
    required: true,
    foreignKey: 'contract_id',
  },
  invoiceCode: {
    type: 'string',
    required: true,
    unique: true,
  },
  billingStartDate: {
    type: 'date',
    required: true,
  },
  billingEndDate: {
    type: 'date',
    required: true,
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
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
  updatedAt: {
    type: 'datetime',
    required: false,
  },
};

export const tableName = 'invoices';

const Invoice = defineModel(tableName, invoiceSchema);

export { Invoice };
export default Invoice;
