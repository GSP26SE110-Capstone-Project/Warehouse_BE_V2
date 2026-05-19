import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as contractItemController from '../controllers/contractItem.controller.js';

const router = Router();

router.post('/', asyncHandler(contractItemController.create));
router.get('/', asyncHandler(contractItemController.list));
router.get('/:contractItemId', asyncHandler(contractItemController.getById));
router.patch('/:contractItemId', asyncHandler(contractItemController.update));
router.delete('/:contractItemId', asyncHandler(contractItemController.remove));

export default router;
