import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import authenticate from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as zoneController from '../controllers/warehouseZone.controller.js';

const router = Router();
const zoneManagers = ['SYSTEM_ADMIN', 'WH_ADMIN'];

router.use(authenticate);

router.get(
  '/planning',
  authorize(...zoneManagers, 'WH_STAFF'),
  asyncHandler(zoneController.getPlanning)
);
router.post('/bulk', authorize(...zoneManagers), asyncHandler(zoneController.createBulk));
router.post('/', authorize(...zoneManagers), asyncHandler(zoneController.create));
router.get('/', authorize(...zoneManagers, 'WH_STAFF'), asyncHandler(zoneController.list));
router.get('/:zoneId', authorize(...zoneManagers, 'WH_STAFF'), asyncHandler(zoneController.getById));
router.patch('/:zoneId', authorize(...zoneManagers), asyncHandler(zoneController.update));
router.delete('/:zoneId', authorize(...zoneManagers), asyncHandler(zoneController.remove));

export default router;
