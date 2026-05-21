import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as categoryController from '../controllers/category.controller.js';

const router = Router();

router.post('/', asyncHandler(categoryController.create));
router.get('/', asyncHandler(categoryController.list));
router.get('/:categoryId', asyncHandler(categoryController.getById));
router.patch('/:categoryId', asyncHandler(categoryController.update));
router.delete('/:categoryId', asyncHandler(categoryController.remove));

export default router;
