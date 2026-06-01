import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as sizeFactorCatalogController from '../controllers/sizeFactorCatalog.controller.js';

const router = Router();

router.get('/', asyncHandler(sizeFactorCatalogController.list));
router.get('/:sizeGroup', asyncHandler(sizeFactorCatalogController.getByGroup));

export default router;
