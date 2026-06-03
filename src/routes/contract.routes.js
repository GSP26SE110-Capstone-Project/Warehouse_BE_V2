import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import authenticate from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as contractController from '../controllers/contract.controller.js';

const router = Router();
const terminationManagers = ['WH_ADMIN', 'SYSTEM_ADMIN'];
const terminationReaders = [...terminationManagers, 'TENANT_ADMIN', 'TENANT_STAFF'];

router.post('/', asyncHandler(contractController.create));
router.get('/', asyncHandler(contractController.list));
router.get('/:contractId/termination/preview', asyncHandler(contractController.previewTermination));
router.post('/:contractId/termination/request', asyncHandler(contractController.requestTermination));
router.get(
  '/:contractId/termination/requests',
  authenticate,
  authorize(...terminationReaders),
  asyncHandler(contractController.listTerminationRequests)
);
router.post(
  '/:contractId/termination/requests/:terminationRequestId/approve',
  authenticate,
  authorize(...terminationManagers),
  asyncHandler(contractController.approveTerminationRequest)
);
router.post(
  '/:contractId/termination/requests/:terminationRequestId/reject',
  authenticate,
  authorize(...terminationManagers),
  asyncHandler(contractController.rejectTerminationRequest)
);
router.get('/:contractId/invoices', asyncHandler(contractController.listInvoices));
router.post(
  '/:contractId/invoices/:invoiceId/payos/create-link',
  asyncHandler(contractController.createPayOSPayment)
);
router.post(
  '/:contractId/invoices/:invoiceId/mark-paid',
  asyncHandler(contractController.markInvoicePaid)
);
router.get('/:contractId', asyncHandler(contractController.getById));
router.patch('/:contractId', asyncHandler(contractController.update));
router.delete('/:contractId', asyncHandler(contractController.remove));

export default router;
