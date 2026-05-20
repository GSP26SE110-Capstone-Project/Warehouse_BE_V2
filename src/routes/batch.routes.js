import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as batchController from '../controllers/batch.controller.js';

const router = Router();

router.post('/', asyncHandler(batchController.create));
router.get('/', asyncHandler(batchController.list));
router.get('/:batchId', asyncHandler(batchController.getById));
router.patch('/:batchId', asyncHandler(batchController.update));
router.delete('/:batchId', asyncHandler(batchController.remove));

export default router;
