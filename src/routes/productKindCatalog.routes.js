import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as productKindCatalogController from '../controllers/productKindCatalog.controller.js';

const router = Router();

router.get('/tree', asyncHandler(productKindCatalogController.getTree));
router.get('/groups', asyncHandler(productKindCatalogController.listGroups));
router.get('/', asyncHandler(productKindCatalogController.list));
router.get('/:productKind', asyncHandler(productKindCatalogController.getByCode));

export default router;
