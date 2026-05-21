import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as inboundRequestController from '../controllers/inboundRequest.controller.js';

const router = Router();

router.post('/', asyncHandler(inboundRequestController.create));
router.get('/', asyncHandler(inboundRequestController.list));
router.get('/:inboundRequestId', asyncHandler(inboundRequestController.getById));
router.patch('/:inboundRequestId', asyncHandler(inboundRequestController.update));
router.delete('/:inboundRequestId', asyncHandler(inboundRequestController.remove));

export default router;
