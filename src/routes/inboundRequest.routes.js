import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as inboundRequestController from '../controllers/inboundRequest.controller.js';
import * as inboundRequestItemController from '../controllers/inboundRequestItem.controller.js';

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

router.get('/:inboundRequestId', asyncHandler(inboundRequestController.getById));
router.patch('/:inboundRequestId', asyncHandler(inboundRequestController.update));
router.delete('/:inboundRequestId', asyncHandler(inboundRequestController.remove));

export default router;
