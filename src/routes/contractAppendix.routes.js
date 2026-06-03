import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import authenticate from '../middleware/authenticate.js';
import assertAppendixInvoice from '../middleware/assertAppendixInvoice.js';
import { authorize } from '../middleware/authorize.js';
import * as contractAppendixController from '../controllers/contractAppendix.controller.js';
import * as contractController from '../controllers/contract.controller.js';

const router = Router({ mergeParams: true });

const appendixManagers = ['WH_ADMIN', 'SYSTEM_ADMIN'];
const appendixReaders = [...appendixManagers, 'TENANT_ADMIN', 'TENANT_STAFF'];
const appendixPayers = ['TENANT_ADMIN'];

router.use(authenticate);

router.get(
  '/ceiling',
  authorize(...appendixReaders),
  asyncHandler(contractAppendixController.getCeiling)
);
router.get('/', authorize(...appendixReaders), asyncHandler(contractAppendixController.list));
router.post(
  '/',
  authorize('TENANT_ADMIN'),
  asyncHandler(contractAppendixController.create)
);
router.get(
  '/:appendixId/payment-preview',
  authorize(...appendixReaders),
  asyncHandler(contractAppendixController.previewPayment)
);
router.get(
  '/:appendixId/invoices',
  authorize(...appendixReaders),
  asyncHandler(contractAppendixController.listInvoices)
);
router.post(
  '/:appendixId/approve',
  authorize(...appendixManagers),
  asyncHandler(contractAppendixController.approve)
);
router.post(
  '/:appendixId/reject',
  authorize(...appendixManagers),
  asyncHandler(contractAppendixController.reject)
);
router.post(
  '/:appendixId/under-review',
  authorize(...appendixManagers),
  asyncHandler(contractAppendixController.markUnderReview)
);
router.post(
  '/:appendixId/terminate',
  authorize(...appendixManagers),
  asyncHandler(contractAppendixController.terminate)
);
router.get(
  '/:appendixId',
  authorize(...appendixReaders),
  asyncHandler(contractAppendixController.getById)
);
router.patch(
  '/:appendixId',
  authorize('TENANT_ADMIN'),
  asyncHandler(contractAppendixController.sign)
);
router.post(
  '/:appendixId/invoices/:invoiceId/payos/create-link',
  authorize(...appendixPayers),
  assertAppendixInvoice,
  asyncHandler(contractController.createPayOSPayment)
);
router.post(
  '/:appendixId/invoices/:invoiceId/mark-paid',
  authorize(...appendixPayers, ...appendixManagers),
  assertAppendixInvoice,
  asyncHandler(contractController.markInvoicePaid)
);
router.delete(
  '/:appendixId',
  authorize('TENANT_ADMIN', ...appendixManagers),
  asyncHandler(contractAppendixController.remove)
);

export default router;
