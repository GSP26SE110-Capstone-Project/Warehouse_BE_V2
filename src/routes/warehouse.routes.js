import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import authenticate from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as warehouseController from '../controllers/warehouse.controller.js';

const router = Router();
const warehouseManagers = ['SYSTEM_ADMIN', 'WH_ADMIN'];
const warehouseReaders = [
  ...warehouseManagers,
  'WH_STAFF',
  'WH_TRANSPORTER',
  'TENANT_ADMIN',
  'TENANT_STAFF',
];

router.use(authenticate);

router.post('/', authorize('SYSTEM_ADMIN'), asyncHandler(warehouseController.create));
router.get('/', authorize(...warehouseReaders), asyncHandler(warehouseController.list));
router.get(
  '/:warehouseId/zone-planning',
  authorize(...warehouseManagers, 'WH_STAFF'),
  asyncHandler(warehouseController.getZonePlanning)
);
router.get(
  '/:warehouseId/capacity-snapshot',
  authorize(...warehouseReaders),
  asyncHandler(warehouseController.getCapacitySnapshot)
);
router.get(
  '/:warehouseId/rental-requests',
  authorize(...warehouseManagers),
  asyncHandler(warehouseController.listRentalRequests)
);
router.get(
  '/:warehouseId/inbound-requests',
  authorize(...warehouseManagers, 'WH_STAFF', 'WH_TRANSPORTER'),
  asyncHandler(warehouseController.listInboundRequests)
);
router.get(
  '/:warehouseId',
  authorize(...warehouseReaders),
  asyncHandler(warehouseController.getById)
);
router.patch(
  '/:warehouseId',
  authorize(...warehouseManagers),
  asyncHandler(warehouseController.update)
);
router.delete(
  '/:warehouseId',
  authorize('SYSTEM_ADMIN'),
  asyncHandler(warehouseController.remove)
);

export default router;
