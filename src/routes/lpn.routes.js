import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as lpnController from '../controllers/lpn.controller.js';

const router = Router();

router.post('/', asyncHandler(lpnController.create));
router.get('/', asyncHandler(lpnController.list));
router.get('/:lpnId/details', asyncHandler(lpnController.getWithDetails));
router.get('/:lpnId/rack-suggestion', asyncHandler(lpnController.getRackSuggestion));
router.get('/:lpnId', asyncHandler(lpnController.getById));
router.patch('/:lpnId', asyncHandler(lpnController.update));
router.delete('/:lpnId', asyncHandler(lpnController.remove));

export default router;
