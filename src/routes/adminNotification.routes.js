import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import authenticate from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as adminNotificationController from '../controllers/adminNotification.controller.js';

const router = Router();

router.get(
  '/guest-account-alerts',
  authenticate,
  authorize('SYSTEM_ADMIN'),
  asyncHandler(adminNotificationController.getGuestAccountAlerts)
);

router.get(
  '/wh-pending-rentals',
  authenticate,
  authorize('WH_ADMIN'),
  asyncHandler(adminNotificationController.getWhPendingRentalAlerts)
);

export default router;
