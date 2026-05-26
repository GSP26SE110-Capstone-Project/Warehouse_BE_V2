import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as shipmentController from '../controllers/shipment.controller.js';

const router = Router();

router.post('/', asyncHandler(shipmentController.create));
router.get('/', asyncHandler(shipmentController.list));
router.get('/:shipmentId', asyncHandler(shipmentController.getById));
router.patch('/:shipmentId', asyncHandler(shipmentController.update));
router.delete('/:shipmentId', asyncHandler(shipmentController.remove));

export default router;
