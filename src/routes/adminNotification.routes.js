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

router.get(
  '/wh-pending-inbounds',
  authenticate,
  authorize('WH_ADMIN'),
  asyncHandler(adminNotificationController.getWhPendingInboundAlerts)
);

router.get(
  '/wh-arrived-inbounds',
  authenticate,
  authorize('WH_ADMIN'),
  asyncHandler(adminNotificationController.getWhArrivedInboundAlerts)
);

router.get(
  '/wh-in-transit-inbounds',
  authenticate,
  authorize('WH_ADMIN'),
  asyncHandler(adminNotificationController.getWhInTransitInboundAlerts)
);

router.get(
  '/wh-contract-payments',
  authenticate,
  authorize('WH_ADMIN'),
  asyncHandler(adminNotificationController.getWhContractPaymentAlerts)
);

router.get(
  '/wh-pending-appendices',
  authenticate,
  authorize('WH_ADMIN'),
  asyncHandler(adminNotificationController.getWhPendingAppendixAlerts)
);

router.get(
  '/transporter-trips',
  authenticate,
  authorize('WH_TRANSPORTER'),
  asyncHandler(adminNotificationController.getTransporterTripAlerts)
);

router.get(
  '/wh-staff-assigned-picks',
  authenticate,
  authorize('WH_STAFF'),
  asyncHandler(adminNotificationController.getWhStaffAssignedPickAlerts)
);

router.get(
  '/tenant-inbound-transport',
  authenticate,
  authorize('TENANT_ADMIN'),
  asyncHandler(adminNotificationController.getTenantInboundTransportAlerts)
);

router.get(
  '/tenant-rental-status',
  authenticate,
  authorize('TENANT_ADMIN'),
  asyncHandler(adminNotificationController.getTenantRentalStatusAlerts)
);

router.get(
  '/tenant-contract-actions',
  authenticate,
  authorize('TENANT_ADMIN'),
  asyncHandler(adminNotificationController.getTenantContractActionAlerts)
);

router.get(
  '/tenant-recurring-rent',
  authenticate,
  authorize('TENANT_ADMIN'),
  asyncHandler(adminNotificationController.getTenantRecurringRentAlerts)
);

export default router;
