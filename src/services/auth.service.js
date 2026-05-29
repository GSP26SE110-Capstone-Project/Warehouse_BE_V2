import User from '../models/User.js';
import { signAccessToken, verifyPasswordResetToken } from '../config/jwt.js';
import AppError from '../utils/AppError.js';
import {
  assertPasswordStrength,
  comparePassword,
  hashPassword,
} from '../utils/password.js';
import { toPublicUser } from '../utils/userPublic.js';
import { sendChangePasswordOtp } from '../config/mail.js';
import { generateOtp, saveOtp, verifyOtp } from '../utils/otpStore.js';

const OTP_TTL_MINUTES = 10;
const OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;

export async function login({ email, password }) {
  if (!email?.trim() || !password) {
    throw new AppError('email and password are required', 400, 'VALIDATION_ERROR');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const publicUser = toPublicUser(user);
  const accessToken = signAccessToken({
    sub: user.userId,
    role: user.role,
    tenantId: user.tenantId ?? null,
    warehouseId: user.warehouseId ?? null,
    email: user.email,
  });

  return { user: publicUser, accessToken };
}

/**
 * Bước 1 — yêu cầu đổi mật khẩu.
 * Verify mật khẩu hiện tại, sinh OTP, gửi email, lưu pending change.
 * Chưa update bảng `users` ở bước này.
 */
export async function requestPasswordChange(userId, { currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) {
    throw new AppError(
      'currentPassword and newPassword are required',
      400,
      'VALIDATION_ERROR',
    );
  }

  const strengthError = assertPasswordStrength(newPassword);
  if (strengthError) {
    throw new AppError(strengthError, 400, 'VALIDATION_ERROR');
  }

  if (currentPassword === newPassword) {
    throw new AppError(
      'New password must differ from current password',
      400,
      'VALIDATION_ERROR',
    );
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  const validCurrent = await comparePassword(currentPassword, user.passwordHash);
  if (!validCurrent) {
    throw new AppError('Current password is incorrect', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.email) {
    throw new AppError(
      'User has no email configured — cannot send OTP',
      400,
      'VALIDATION_ERROR',
    );
  }

  const newPasswordHash = await hashPassword(newPassword);
  const otp = generateOtp(6);

  saveOtp(userId, {
    otp,
    ttlMs: OTP_TTL_MS,
    payload: { newPasswordHash },
  });

  try {
    await sendChangePasswordOtp({
      to: user.email,
      fullName: user.fullName,
      otp,
      ttlMinutes: OTP_TTL_MINUTES,
    });
  } catch (err) {
    throw new AppError(
      `Failed to send OTP email: ${err.message}`,
      502,
      'MAIL_SEND_FAILED',
    );
  }

  return {
    email: user.email,
    expiresInMinutes: OTP_TTL_MINUTES,
  };
}

/**
 * Bước 2 — xác nhận OTP và áp dụng đổi mật khẩu.
 */
export async function confirmPasswordChange(userId, { otp }) {
  if (!otp || !String(otp).trim()) {
    throw new AppError('otp is required', 400, 'VALIDATION_ERROR');
  }

  const result = verifyOtp(userId, String(otp).trim());

  if (!result.ok) {
    if (result.reason === 'NOT_FOUND') {
      throw new AppError(
        'No pending password change. Request OTP again.',
        400,
        'OTP_NOT_FOUND',
      );
    }
    if (result.reason === 'EXPIRED') {
      throw new AppError('OTP expired. Request a new one.', 400, 'OTP_EXPIRED');
    }
    if (result.reason === 'LOCKED') {
      throw new AppError(
        'Too many wrong attempts. Request a new OTP.',
        400,
        'OTP_LOCKED',
      );
    }
    throw new AppError(
      `Incorrect OTP. ${result.attemptsLeft ?? 0} attempt(s) left.`,
      400,
      'OTP_MISMATCH',
    );
  }

  const { newPasswordHash } = result.payload;
  await User.updateById(userId, { passwordHash: newPasswordHash });

  return { changedAt: new Date().toISOString() };
}

/**
 * Đặt lại mật khẩu bằng token từ email (welcome / forgot password).
 * Không cần đăng nhập, không cần mật khẩu cũ.
 */
export async function resetPasswordWithToken({ token, newPassword }) {
  if (!token?.trim()) {
    throw new AppError('token is required', 400, 'VALIDATION_ERROR');
  }
  if (!newPassword) {
    throw new AppError('newPassword is required', 400, 'VALIDATION_ERROR');
  }

  const strengthError = assertPasswordStrength(newPassword);
  if (strengthError) {
    throw new AppError(strengthError, 400, 'VALIDATION_ERROR');
  }

  let userId;
  try {
    userId = verifyPasswordResetToken(token.trim());
  } catch {
    throw new AppError('Invalid or expired reset link', 400, 'RESET_TOKEN_INVALID');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('Invalid or expired reset link', 400, 'RESET_TOKEN_INVALID');
  }
  if (user.status !== 'ACTIVE') {
    throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');
  }

  const passwordHash = await hashPassword(newPassword);
  await User.updateById(userId, { passwordHash });

  return { changedAt: new Date().toISOString() };
}
