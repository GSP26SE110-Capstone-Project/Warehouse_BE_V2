import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as skuController from '../controllers/sku.controller.js';

const router = Router();

router.post('/', asyncHandler(skuController.create));
router.get('/', asyncHandler(skuController.list));
router.get('/:skuId', asyncHandler(skuController.getById));
router.patch('/:skuId', asyncHandler(skuController.update));
router.delete('/:skuId', asyncHandler(skuController.remove));

export default router;
