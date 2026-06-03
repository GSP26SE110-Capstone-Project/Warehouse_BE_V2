import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import authenticate from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as scanController from '../controllers/scan.controller.js';

const router = Router();
const scanRoles = ['SYSTEM_ADMIN', 'WH_ADMIN', 'WH_STAFF', 'WH_TRANSPORTER'];

router.use(authenticate);
router.use(authorize(...scanRoles));

router.get('/resolve', asyncHandler(scanController.resolve));
router.post('/resolve', asyncHandler(scanController.resolve));

export default router;
