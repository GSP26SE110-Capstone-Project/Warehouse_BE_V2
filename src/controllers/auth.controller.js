import * as authService from '../services/auth.service.js';
import { success } from '../utils/apiResponse.js';

export async function login(req, res) {
  const result = await authService.login(req.body);
  success(res, result, 'Login successful');
}

export async function requestChangePassword(req, res) {
  const result = await authService.requestPasswordChange(req.user.userId, req.body);
  success(
    res,
    result,
    'OTP đã được gửi tới email. Nhập OTP để hoàn tất đổi mật khẩu.',
  );
}

export async function confirmChangePassword(req, res) {
  const result = await authService.confirmPasswordChange(req.user.userId, req.body);
  success(res, result, 'Đổi mật khẩu thành công.');
}

export async function resetPassword(req, res) {
  const result = await authService.resetPasswordWithToken(req.body);
  success(res, result, 'Đặt lại mật khẩu thành công.');
}
