import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as outboundRequestController from '../controllers/outboundRequest.controller.js';

const router = Router();

router.post('/', asyncHandler(outboundRequestController.create));
router.get('/', asyncHandler(outboundRequestController.list));
router.get('/:outboundRequestId', asyncHandler(outboundRequestController.getById));
router.patch('/:outboundRequestId', asyncHandler(outboundRequestController.update));
router.delete('/:outboundRequestId', asyncHandler(outboundRequestController.remove));

export default router;
