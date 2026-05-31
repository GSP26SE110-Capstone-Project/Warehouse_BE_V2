import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', asyncHandler(authController.login));

// Reset bằng token gửi trong welcome email (system admin tạo user).
router.post('/reset-password', asyncHandler(authController.resetPassword));

// Quên mật khẩu — flow 2 bước qua OTP email, KHÔNG cần đăng nhập.
//   Bước 1: POST /forgot-password         { email }              → gửi OTP về email
//   Bước 2: POST /forgot-password/verify  { email, otp, newPassword } → đổi mật khẩu
router.post(
  '/forgot-password',
  asyncHandler(authController.requestForgotPassword),
);
router.post(
  '/forgot-password/verify',
  asyncHandler(authController.confirmForgotPassword),
);

export default router;
