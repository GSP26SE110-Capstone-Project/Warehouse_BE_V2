import User from "../models/User.js";
import { verifyAccessToken } from "../config/jwt.js";
import AppError from "../utils/AppError.js";
import { toPublicUser } from "../utils/userPublic.js";

export default async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
  }

  const token = header.slice(7).trim();
  if (!token) {
    throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new AppError("Invalid or expired token", 401, "UNAUTHENTICATED");
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== "ACTIVE") {
    throw new AppError("User not found or inactive", 401, "UNAUTHENTICATED");
  }

  req.user = toPublicUser(user);
  req.auth = payload;
  next();
}
