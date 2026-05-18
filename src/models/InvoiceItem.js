import defineModel from './defineModel.js';

export const invoiceItemSchema = {
  invoiceItemId: {
    type: 'string',
    primaryKey: true,
  },
  invoiceId: {
    type: 'string',
    required: true,
    foreignKey: 'invoice_id',
  },
  itemType: {
    type: 'string',
    required: true,
  },
  description: {
    type: 'string',
    required: false,
  },
  referenceId: {
    type: 'string',
    required: false,
  },
  quantity: {
    type: 'decimal',
    required: true,
  },
  unitPrice: {
    type: 'decimal',
    required: true,
  },
  totalPrice: {
    type: 'decimal',
    required: true,
  },
};

export const tableName = 'invoice_items';

const InvoiceItem = defineModel(tableName, invoiceItemSchema);

export { InvoiceItem };
export default InvoiceItem;
