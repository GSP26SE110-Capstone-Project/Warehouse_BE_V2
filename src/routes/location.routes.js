import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as locationController from '../controllers/location.controller.js';

const router = Router();

router.get('/warehouses', asyncHandler(locationController.listWarehousesInRegion));
router.get('/', asyncHandler(locationController.listTree));

export default router;
