import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import authenticate from '../middleware/authenticate.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', asyncHandler(authController.login));

router.post('/reset-password', asyncHandler(authController.resetPassword));

// Đổi mật khẩu cần xác nhận OTP qua email — 2 bước.
router.post(
  '/change-password',
  authenticate,
  asyncHandler(authController.requestChangePassword),
);
router.post(
  '/change-password/verify',
  authenticate,
  asyncHandler(authController.confirmChangePassword),
);

export default router;
