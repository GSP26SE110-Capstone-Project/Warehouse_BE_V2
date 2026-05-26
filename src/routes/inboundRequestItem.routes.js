import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as inboundRequestItemController from '../controllers/inboundRequestItem.controller.js';

const router = Router();

router.post('/', asyncHandler(inboundRequestItemController.create));
router.get('/', asyncHandler(inboundRequestItemController.list));
router.get('/:inboundRequestItemId', asyncHandler(inboundRequestItemController.getById));
router.patch('/:inboundRequestItemId', asyncHandler(inboundRequestItemController.update));
router.delete('/:inboundRequestItemId', asyncHandler(inboundRequestItemController.remove));

export default router;
