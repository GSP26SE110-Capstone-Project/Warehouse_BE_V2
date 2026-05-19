import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as rackLevelController from '../controllers/rackLevel.controller.js';

const router = Router();

router.post('/', asyncHandler(rackLevelController.create));
router.get('/', asyncHandler(rackLevelController.list));
router.get('/:rackLevelId', asyncHandler(rackLevelController.getById));
router.patch('/:rackLevelId', asyncHandler(rackLevelController.update));
router.delete('/:rackLevelId', asyncHandler(rackLevelController.remove));

export default router;
