import User from "../models/User.js";
import { verifyAccessToken } from "../config/jwt.js";
import AppError from "../utils/AppError.js";
import { toPublicUser } from "../utils/userPublic.js";

export default async function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || typeof header !== "string") {
    throw new AppError("Vui lòng đăng nhập (thiếu token xác thực).", 401, "UNAUTHENTICATED");
  }

  const trimmed = header.trim();
  if (!trimmed.startsWith("Bearer")) {
    throw new AppError("Vui lòng đăng nhập (định dạng Authorization không hợp lệ).", 401, "UNAUTHENTICATED");
  }

  const token = trimmed.slice("Bearer".length).trim();
  if (!token) {
    throw new AppError("Vui lòng đăng nhập (token không hợp lệ hoặc rỗng).", 401, "UNAUTHENTICATED");
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    console.error("[AUTH] Token verification failed:", err?.message || err);
    throw new AppError("Phiên đăng nhập hết hạn hoặc token không hợp lệ. Vui lòng đăng nhập lại.", 401, "UNAUTHENTICATED");
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== "ACTIVE") {
    throw new AppError("Tài khoản không tồn tại hoặc đã bị khóa.", 401, "UNAUTHENTICATED");
  }

  req.user = toPublicUser(user);
  req.auth = payload;
  next();
}
