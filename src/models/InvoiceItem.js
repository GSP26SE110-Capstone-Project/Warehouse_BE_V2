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
    required: false,
  },
  description: {
    type: 'string',
    required: false,
  },
  quantity: {
    type: 'decimal',
    required: false,
  },
  unitPrice: {
    type: 'decimal',
    required: false,
  },
  totalPrice: {
    type: 'decimal',
    required: false,
  },
};

export const tableName = 'invoice_items';

const InvoiceItem = defineModel(tableName, invoiceItemSchema);

export { InvoiceItem };
export default InvoiceItem;
