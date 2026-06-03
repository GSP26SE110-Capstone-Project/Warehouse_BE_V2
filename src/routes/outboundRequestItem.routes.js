import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import authenticate from '../middleware/authenticate.js';
import * as outboundRequestItemController from '../controllers/outboundRequestItem.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', asyncHandler(outboundRequestItemController.create));
router.get('/', asyncHandler(outboundRequestItemController.list));
router.get('/:outboundRequestItemId', asyncHandler(outboundRequestItemController.getById));
router.patch('/:outboundRequestItemId', asyncHandler(outboundRequestItemController.update));
router.delete('/:outboundRequestItemId', asyncHandler(outboundRequestItemController.remove));

export default router;
