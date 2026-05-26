import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as inboundRequestController from '../controllers/inboundRequest.controller.js';
import * as inboundRequestItemController from '../controllers/inboundRequestItem.controller.js';
import * as inboundDeliveryController from '../controllers/inboundDelivery.controller.js';

const router = Router();

router.post('/', asyncHandler(inboundRequestController.create));
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
router.post('/:inboundRequestId/complete', asyncHandler(inboundRequestController.complete));

router.get('/:inboundRequestId', asyncHandler(inboundRequestController.getById));
router.patch('/:inboundRequestId', asyncHandler(inboundRequestController.update));
router.delete('/:inboundRequestId', asyncHandler(inboundRequestController.remove));

export default router;
