import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as rentalRequestController from '../controllers/rentalRequest.controller.js';

const router = Router();

// Must be before /:rentalRequestId — Express 5 treats "lookup" as :id otherwise (400 Invalid UUID)
router.get('/guest/lookup', asyncHandler(rentalRequestController.lookupByCode));
router.post('/', asyncHandler(rentalRequestController.create));
router.get('/', asyncHandler(rentalRequestController.list));
router.get('/:rentalRequestId', asyncHandler(rentalRequestController.getById));
router.patch('/:rentalRequestId', asyncHandler(rentalRequestController.update));
router.delete('/:rentalRequestId', asyncHandler(rentalRequestController.remove));

export default router;
