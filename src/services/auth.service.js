import User from '../models/User.js';
import { signAccessToken, verifyPasswordResetToken } from '../config/jwt.js';
import AppError from '../utils/AppError.js';
import { findTenantCompanyByContactEmail } from './tenantCompany.service.js';
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

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function otpKeyForEmail(email) {
  return `forgot-password:${normalizeEmail(email)}`;
}

export async function login({ email, password }) {
  if (!email?.trim() || !password) {
    throw new AppError('email and password are required', 400, 'VALIDATION_ERROR');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    const tenant = await findTenantCompanyByContactEmail(normalizedEmail);
    if (tenant) {
      const companyLabel = tenant.companyName?.trim() || 'công ty của bạn';
      throw new AppError(
        `Email này đã được đăng ký với ${companyLabel} trên hệ thống, nhưng tài khoản đăng nhập chưa được cấp. ` +
          'Vui lòng chờ kho duyệt yêu cầu thuê và gửi thông tin kích hoạt, hoặc tra cứu trạng thái yêu cầu trên trang chủ (mã RR + email).',
        403,
        'TENANT_ACCOUNT_NOT_PROVISIONED'
      );
    }
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (user.status !== 'ACTIVE') {
    const inactiveMessage = user.tenantId
      ? 'Tài khoản của bạn chưa được kích hoạt. Kiểm tra email để đặt mật khẩu lần đầu hoặc liên hệ quản trị viên kho.'
      : 'Tài khoản chưa được kích hoạt. Liên hệ quản trị viên để được hỗ trợ.';
    throw new AppError(inactiveMessage, 403, 'ACCOUNT_INACTIVE');
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
 * Bước 1 — quên mật khẩu: input email → gửi OTP về email.
 *
 * Phản hồi luôn giống nhau dù email tồn tại hay không, để tránh user enumeration.
 * OTP key theo email (không cần userId vì user chưa đăng nhập).
 */
export async function requestForgotPassword({ email }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new AppError('email is required', 400, 'VALIDATION_ERROR');
  }

  const user = await User.findOne({ email: normalizedEmail });

  // Email không tồn tại / account inactive → vẫn trả 200 success, không gửi OTP.
  // Mục đích: kẻ tấn công không thể dùng endpoint này để dò email hợp lệ.
  if (!user || user.status !== 'ACTIVE') {
    return { email: normalizedEmail, expiresInMinutes: OTP_TTL_MINUTES };
  }

  const otp = generateOtp(6);
  saveOtp(otpKeyForEmail(normalizedEmail), {
    otp,
    ttlMs: OTP_TTL_MS,
    payload: { userId: user.userId },
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
    email: normalizedEmail,
    expiresInMinutes: OTP_TTL_MINUTES,
  };
}

/**
 * Bước 2 — xác nhận OTP + áp dụng mật khẩu mới.
 */
export async function confirmForgotPassword({ email, otp, newPassword }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new AppError('email is required', 400, 'VALIDATION_ERROR');
  }
  if (!otp || !String(otp).trim()) {
    throw new AppError('otp is required', 400, 'VALIDATION_ERROR');
  }
  if (!newPassword) {
    throw new AppError('newPassword is required', 400, 'VALIDATION_ERROR');
  }

  const strengthError = assertPasswordStrength(newPassword);
  if (strengthError) {
    throw new AppError(strengthError, 400, 'VALIDATION_ERROR');
  }

  const result = verifyOtp(otpKeyForEmail(normalizedEmail), String(otp).trim());

  if (!result.ok) {
    if (result.reason === 'NOT_FOUND') {
      throw new AppError(
        'Không tìm thấy OTP cho email này. Vui lòng yêu cầu OTP mới.',
        400,
        'OTP_NOT_FOUND',
      );
    }
    if (result.reason === 'EXPIRED') {
      throw new AppError('OTP đã hết hạn. Vui lòng yêu cầu OTP mới.', 400, 'OTP_EXPIRED');
    }
    if (result.reason === 'LOCKED') {
      throw new AppError(
        'Nhập sai OTP quá nhiều lần. Vui lòng yêu cầu OTP mới.',
        400,
        'OTP_LOCKED',
      );
    }
    throw new AppError(
      `OTP không đúng. Còn ${result.attemptsLeft ?? 0} lần thử.`,
      400,
      'OTP_MISMATCH',
    );
  }

  const { userId } = result.payload;
  const user = await User.findById(userId);
  if (!user || user.status !== 'ACTIVE') {
    throw new AppError(
      'Tài khoản không khả dụng. Vui lòng liên hệ quản trị viên.',
      403,
      'ACCOUNT_INACTIVE',
    );
  }

  const passwordHash = await hashPassword(newPassword);
  await User.updateById(userId, { passwordHash });

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

/**
 * Đổi mật khẩu khi đã đăng nhập — verify mật khẩu cũ, không cần OTP.
 */
export async function changePassword(userId, { currentPassword, newPassword }) {
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
  if (user.status !== 'ACTIVE') {
    throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');
  }

  const validCurrent = await comparePassword(currentPassword, user.passwordHash);
  if (!validCurrent) {
    throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
  }

  const passwordHash = await hashPassword(newPassword);
  await User.updateById(userId, { passwordHash });

  return { changedAt: new Date().toISOString() };
}
