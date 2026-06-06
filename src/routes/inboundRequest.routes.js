import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import authenticate from '../middleware/authenticate.js';
import AppError from '../utils/AppError.js';
import * as inboundRequestController from '../controllers/inboundRequest.controller.js';
import * as inboundRequestItemController from '../controllers/inboundRequestItem.controller.js';
import * as inboundDeliveryController from '../controllers/inboundDelivery.controller.js';

const router = Router();
const blockWhAdminCreate = (req, _res, next) => {
  if (req.user?.role === 'WH_ADMIN') {
    throw new AppError(
      'Warehouse admin không được tạo inbound request',
      403,
      'FORBIDDEN'
    );
  }
  next();
};

router.use(authenticate);

router.post('/', blockWhAdminCreate, asyncHandler(inboundRequestController.create));
router.get('/', asyncHandler(inboundRequestController.list));

router.get(
  '/:inboundRequestId/items',
  asyncHandler(inboundRequestItemController.list)
);
router.post(
  '/:inboundRequestId/items',
  asyncHandler(inboundRequestItemController.create)
);

router.get(
  '/:inboundRequestId/approval-readiness',
  asyncHandler(inboundRequestController.getApprovalReadiness)
);

router.get(
  '/:inboundRequestId/delivery',
  asyncHandler(inboundDeliveryController.getByInboundRequest)
);
router.put(
  '/:inboundRequestId/delivery',
  asyncHandler(inboundDeliveryController.upsert)
);
router.delete(
  '/:inboundRequestId/delivery',
  asyncHandler(inboundDeliveryController.remove)
);

router.post(
  '/:inboundRequestId/start-receiving',
  asyncHandler(inboundRequestController.startReceiving)
);
router.post(
  '/:inboundRequestId/complete-receiving',
  asyncHandler(inboundRequestController.completeReceiving)
);
router.post(
  '/:inboundRequestId/bulk-putaway',
  asyncHandler(inboundRequestController.bulkPutaway)
);
router.post(
  '/:inboundRequestId/auto-putaway',
  asyncHandler(inboundRequestController.autoPutaway)
);
router.post('/:inboundRequestId/complete', asyncHandler(inboundRequestController.complete));
router.post(
  '/:inboundRequestId/report-pickup',
  asyncHandler(inboundRequestController.reportPickup)
);
router.post(
  '/:inboundRequestId/report-arrival',
  asyncHandler(inboundRequestController.reportArrival)
);

router.get('/:inboundRequestId', asyncHandler(inboundRequestController.getById));
router.patch('/:inboundRequestId', asyncHandler(inboundRequestController.update));
router.delete('/:inboundRequestId', asyncHandler(inboundRequestController.remove));

export default router;
