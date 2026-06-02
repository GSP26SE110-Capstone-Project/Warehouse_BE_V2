import User from '../models/User.js';
import { verifyAccessToken } from '../config/jwt.js';
import { toPublicUser } from '../utils/userPublic.js';

/**
 * Optional auth:
 * - No Bearer token: continue as guest
 * - Valid Bearer token: attach req.user / req.auth
 * - Invalid token: ignore and continue as guest
 */
export default async function authenticateOptional(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next();
  }

  const token = header.slice(7).trim();
  if (!token) return next();

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next();
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'ACTIVE') {
    return next();
  }

  req.user = toPublicUser(user);
  req.auth = payload;
  next();
}
