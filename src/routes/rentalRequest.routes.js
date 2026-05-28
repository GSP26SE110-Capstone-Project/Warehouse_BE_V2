import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import authenticate from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as rentalRequestController from '../controllers/rentalRequest.controller.js';

const router = Router();
const rentalManagers = ['SYSTEM_ADMIN', 'WH_ADMIN'];

// Must be before /:rentalRequestId — Express 5 treats "lookup" as :id otherwise (400 Invalid UUID)
router.get('/guest/lookup', asyncHandler(rentalRequestController.lookupByCode));
router.post('/', asyncHandler(rentalRequestController.create));
router.get('/', authenticate, authorize(...rentalManagers), asyncHandler(rentalRequestController.list));
router.get(
  '/:rentalRequestId/price-estimate',
  authenticate,
  authorize(...rentalManagers),
  asyncHandler(rentalRequestController.getPriceEstimate)
);
router.get(
  '/:rentalRequestId',
  authenticate,
  authorize(...rentalManagers),
  asyncHandler(rentalRequestController.getById)
);
router.patch(
  '/:rentalRequestId',
  authenticate,
  authorize(...rentalManagers),
  asyncHandler(rentalRequestController.update)
);
router.delete(
  '/:rentalRequestId',
  authenticate,
  authorize('SYSTEM_ADMIN'),
  asyncHandler(rentalRequestController.remove)
);

export default router;
