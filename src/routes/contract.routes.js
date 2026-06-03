import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import authenticate from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as contractController from '../controllers/contract.controller.js';
import contractAppendixRoutes from './contractAppendix.routes.js';

const router = Router();
const terminationManagers = ['WH_ADMIN', 'SYSTEM_ADMIN'];
const terminationReaders = [...terminationManagers, 'TENANT_ADMIN', 'TENANT_STAFF'];

router.post('/', asyncHandler(contractController.create));
router.get('/', asyncHandler(contractController.list));
router.use('/:contractId/appendices', contractAppendixRoutes);
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
const contractReaders = ['WH_ADMIN', 'SYSTEM_ADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'];

router.get(
  '/:contractId/invoices',
  authenticate,
  authorize(...contractReaders),
  asyncHandler(contractController.listInvoices)
);
router.post(
  '/:contractId/invoices/:invoiceId/payos/create-link',
  authenticate,
  authorize('TENANT_ADMIN'),
  asyncHandler(contractController.createPayOSPayment)
);
router.post(
  '/:contractId/invoices/:invoiceId/mark-paid',
  authenticate,
  authorize('TENANT_ADMIN', 'WH_ADMIN', 'SYSTEM_ADMIN'),
  asyncHandler(contractController.markInvoicePaid)
);
router.get('/:contractId', asyncHandler(contractController.getById));
router.patch('/:contractId', asyncHandler(contractController.update));
router.delete('/:contractId', asyncHandler(contractController.remove));

export default router;
