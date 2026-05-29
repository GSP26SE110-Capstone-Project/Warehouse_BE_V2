import jwt from 'jsonwebtoken';

const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
const passwordResetExpiresIn = process.env.PASSWORD_RESET_EXPIRES_IN || '72h';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set in environment');
  }
  return secret;
}

export function signAccessToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, getSecret());
}

/** Token one-time set password (welcome email / forgot password link). */
export function signPasswordResetToken(userId) {
  return jwt.sign({ sub: userId, type: 'password_reset' }, getSecret(), {
    expiresIn: passwordResetExpiresIn,
  });
}

export function verifyPasswordResetToken(token) {
  const payload = jwt.verify(token, getSecret());
  if (payload.type !== 'password_reset' || !payload.sub) {
    const err = new Error('Invalid password reset token');
    err.name = 'JsonWebTokenError';
    throw err;
  }
  return String(payload.sub);
}
