import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import authenticate from '../middleware/authenticate.js';
import AppError from '../utils/AppError.js';
import * as outboundRequestController from '../controllers/outboundRequest.controller.js';
import * as outboundRequestItemController from '../controllers/outboundRequestItem.controller.js';
import * as outboundDeliveryController from '../controllers/outboundDelivery.controller.js';

const router = Router();
const blockWhAdminCreate = (req, _res, next) => {
  if (req.user?.role === 'WH_ADMIN') {
    throw new AppError(
      'Warehouse admin không được tạo outbound request',
      403,
      'FORBIDDEN'
    );
  }
  next();
};

router.use(authenticate);

router.post('/', blockWhAdminCreate, asyncHandler(outboundRequestController.create));
router.get('/', asyncHandler(outboundRequestController.list));

router.get(
  '/:outboundRequestId/items',
  asyncHandler(outboundRequestItemController.list)
);
router.post(
  '/:outboundRequestId/items',
  blockWhAdminCreate,
  asyncHandler(outboundRequestItemController.create)
);
router.get(
  '/:outboundRequestId/fifo-preview',
  asyncHandler(outboundRequestController.previewFifoAllocation)
);
router.get(
  '/:outboundRequestId/picking-tasks',
  asyncHandler(outboundRequestController.listPickingTasks)
);
router.patch(
  '/:outboundRequestId/picking-tasks/assign',
  asyncHandler(outboundRequestController.assignPicker)
);

router.get(
  '/:outboundRequestId/delivery',
  asyncHandler(outboundDeliveryController.getByOutboundRequest)
);
router.put(
  '/:outboundRequestId/delivery',
  asyncHandler(outboundDeliveryController.upsert)
);
router.post(
  '/:outboundRequestId/report-pickup',
  asyncHandler(outboundDeliveryController.reportPickup)
);
router.post(
  '/:outboundRequestId/report-delivery',
  asyncHandler(outboundDeliveryController.reportDelivery)
);

router.get('/:outboundRequestId', asyncHandler(outboundRequestController.getById));
router.patch('/:outboundRequestId', asyncHandler(outboundRequestController.update));
router.delete('/:outboundRequestId', asyncHandler(outboundRequestController.remove));

export default router;
