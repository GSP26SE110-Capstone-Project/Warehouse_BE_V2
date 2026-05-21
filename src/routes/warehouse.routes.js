import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as warehouseController from '../controllers/warehouse.controller.js';

const router = Router();

router.post('/', asyncHandler(warehouseController.create));
router.get('/', asyncHandler(warehouseController.list));
router.get('/:warehouseId/rental-requests', asyncHandler(warehouseController.listRentalRequests));
router.get('/:warehouseId/inbound-requests', asyncHandler(warehouseController.listInboundRequests));
router.get('/:warehouseId', asyncHandler(warehouseController.getById));
router.patch('/:warehouseId', asyncHandler(warehouseController.update));
router.delete('/:warehouseId', asyncHandler(warehouseController.remove));

export default router;
