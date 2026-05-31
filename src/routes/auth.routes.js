import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import authenticate from '../middleware/authenticate.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', asyncHandler(authController.login));

// Reset bằng token gửi trong welcome email (system admin tạo user).
router.post('/reset-password', asyncHandler(authController.resetPassword));

// Quên mật khẩu — flow 2 bước qua OTP email, KHÔNG cần đăng nhập.
router.post(
  '/forgot-password',
  asyncHandler(authController.requestForgotPassword),
);
router.post(
  '/forgot-password/verify',
  asyncHandler(authController.confirmForgotPassword),
);

// Đổi mật khẩu khi đã đăng nhập — verify mật khẩu cũ, không cần OTP.
router.post(
  '/change-password',
  authenticate,
  asyncHandler(authController.changePassword),
);

export default router;
