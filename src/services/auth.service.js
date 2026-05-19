import User from '../models/User.js';
import { signAccessToken } from '../config/jwt.js';
import AppError from '../utils/AppError.js';
import { comparePassword } from '../utils/password.js';
import { toPublicUser } from '../utils/userPublic.js';

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
