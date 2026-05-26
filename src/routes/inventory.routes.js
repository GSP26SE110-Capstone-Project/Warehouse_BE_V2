import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as inventoryController from '../controllers/inventory.controller.js';

const router = Router();

router.get('/', asyncHandler(inventoryController.list));
router.get('/:inventoryId/movements', asyncHandler(inventoryController.listMovements));
router.get('/:inventoryId', asyncHandler(inventoryController.getById));

export default router;
