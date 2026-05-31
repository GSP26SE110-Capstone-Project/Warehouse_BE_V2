import * as authService from '../services/auth.service.js';
import { success } from '../utils/apiResponse.js';

export async function login(req, res) {
  const result = await authService.login(req.body);
  success(res, result, 'Login successful');
}

export async function requestForgotPassword(req, res) {
  const result = await authService.requestForgotPassword(req.body);
  success(
    res,
    result,
    'OTP đã được gửi tới email nếu tài khoản tồn tại. Nhập OTP để đặt lại mật khẩu.',
  );
}

export async function confirmForgotPassword(req, res) {
  const result = await authService.confirmForgotPassword(req.body);
  success(res, result, 'Đặt lại mật khẩu thành công.');
}

export async function resetPassword(req, res) {
  const result = await authService.resetPasswordWithToken(req.body);
  success(res, result, 'Đặt lại mật khẩu thành công.');
}

export async function changePassword(req, res) {
  const result = await authService.changePassword(req.user.userId, req.body);
  success(res, result, 'Đổi mật khẩu thành công.');
}
