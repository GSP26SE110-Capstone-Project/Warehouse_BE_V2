import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as binController from '../controllers/bin.controller.js';

const router = Router();

router.post('/bulk', asyncHandler(binController.createBulk));
router.post('/bulk-delete', asyncHandler(binController.removeBulk));
router.post('/', asyncHandler(binController.create));
router.get('/', asyncHandler(binController.list));
router.get('/:binId', asyncHandler(binController.getById));
router.patch('/:binId', asyncHandler(binController.update));
router.delete('/:binId', asyncHandler(binController.remove));

export default router;
