import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as contractController from '../controllers/contract.controller.js';

const router = Router();

router.post('/', asyncHandler(contractController.create));
router.get('/', asyncHandler(contractController.list));
router.get('/:contractId', asyncHandler(contractController.getById));
router.patch('/:contractId', asyncHandler(contractController.update));
router.delete('/:contractId', asyncHandler(contractController.remove));

export default router;
