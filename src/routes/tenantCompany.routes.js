import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as tenantController from '../controllers/tenantCompany.controller.js';

const router = Router();

router.post('/', asyncHandler(tenantController.create));
router.get('/', asyncHandler(tenantController.list));
router.get('/:tenantId', asyncHandler(tenantController.getById));
router.patch('/:tenantId', asyncHandler(tenantController.update));
router.delete('/:tenantId', asyncHandler(tenantController.remove));

export default router;
