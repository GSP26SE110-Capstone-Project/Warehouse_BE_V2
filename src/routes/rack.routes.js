import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as rackController from '../controllers/rack.controller.js';

const router = Router();

router.post('/', asyncHandler(rackController.create));
router.get('/', asyncHandler(rackController.list));
router.get('/:rackId', asyncHandler(rackController.getById));
router.patch('/:rackId', asyncHandler(rackController.update));
router.delete('/:rackId', asyncHandler(rackController.remove));

export default router;
