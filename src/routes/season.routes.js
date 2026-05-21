import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as seasonController from '../controllers/season.controller.js';

const router = Router();

router.post('/', asyncHandler(seasonController.create));
router.get('/', asyncHandler(seasonController.list));
router.get('/:seasonId', asyncHandler(seasonController.getById));
router.patch('/:seasonId', asyncHandler(seasonController.update));
router.delete('/:seasonId', asyncHandler(seasonController.remove));

export default router;
