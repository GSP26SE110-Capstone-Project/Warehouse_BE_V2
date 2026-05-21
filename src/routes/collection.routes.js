import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as collectionController from '../controllers/collection.controller.js';

const router = Router();

router.post('/', asyncHandler(collectionController.create));
router.get('/', asyncHandler(collectionController.list));
router.get('/:collectionId', asyncHandler(collectionController.getById));
router.patch('/:collectionId', asyncHandler(collectionController.update));
router.delete('/:collectionId', asyncHandler(collectionController.remove));

export default router;
