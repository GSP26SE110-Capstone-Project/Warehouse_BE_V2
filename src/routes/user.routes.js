import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import authenticate from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

const userManagers = ['SYSTEM_ADMIN', 'WH_ADMIN', 'TENANT_ADMIN'];

router.use(authenticate);

router.get('/me', asyncHandler(userController.me));

router.get('/', authorize(...userManagers), asyncHandler(userController.list));
router.post('/', authorize(...userManagers), asyncHandler(userController.create));
router.get('/:userId', authorize(...userManagers), asyncHandler(userController.getById));
router.patch('/:userId', authorize(...userManagers), asyncHandler(userController.update));

export default router;
