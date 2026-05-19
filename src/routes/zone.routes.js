import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as zoneController from '../controllers/warehouseZone.controller.js';

const router = Router();

router.post('/', asyncHandler(zoneController.create));
router.get('/', asyncHandler(zoneController.list));
router.get('/:zoneId', asyncHandler(zoneController.getById));
router.patch('/:zoneId', asyncHandler(zoneController.update));
router.delete('/:zoneId', asyncHandler(zoneController.remove));

export default router;
