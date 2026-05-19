import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as reservationController from '../controllers/storageReservation.controller.js';

const router = Router();

router.post('/', asyncHandler(reservationController.create));
router.get('/', asyncHandler(reservationController.list));
router.get('/:reservationId', asyncHandler(reservationController.getById));
router.patch('/:reservationId', asyncHandler(reservationController.update));
router.delete('/:reservationId', asyncHandler(reservationController.remove));

export default router;
