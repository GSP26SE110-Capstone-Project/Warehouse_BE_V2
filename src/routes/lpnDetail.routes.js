import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as lpnDetailController from '../controllers/lpnDetail.controller.js';

const router = Router();

router.post('/', asyncHandler(lpnDetailController.create));
router.get('/', asyncHandler(lpnDetailController.list));
router.get('/:lpnDetailId', asyncHandler(lpnDetailController.getById));
router.patch('/:lpnDetailId', asyncHandler(lpnDetailController.update));
router.delete('/:lpnDetailId', asyncHandler(lpnDetailController.remove));

export default router;
