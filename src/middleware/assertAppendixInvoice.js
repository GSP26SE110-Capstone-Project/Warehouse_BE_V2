import Invoice from '../models/Invoice.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';

/** Đảm bảo invoice thuộc đúng phụ lục trên URL thanh toán. */
export default async function assertAppendixInvoice(req, _res, next) {
  const contractId = parseUuid(req.params.contractId, 'contractId');
  const appendixId = parseUuid(req.params.appendixId, 'appendixId');
  const invoiceId = parseUuid(req.params.invoiceId, 'invoiceId');

  const invoice = await Invoice.findById(invoiceId);
  if (
    !invoice ||
    invoice.contractId !== contractId ||
    invoice.appendixId !== appendixId
  ) {
    throw new AppError('Invoice không thuộc phụ lục này', 404, 'NOT_FOUND');
  }
  if (invoice.invoiceCategory !== 'APPENDIX_INITIAL') {
    throw new AppError('Invoice không phải loại phụ lục', 400, 'VALIDATION_ERROR');
  }

  next();
}
