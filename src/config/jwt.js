import jwt from 'jsonwebtoken';

const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

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
