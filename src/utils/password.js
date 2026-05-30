import bcrypt from 'bcrypt';

const ROUNDS = 10;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

export async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function assertPasswordStrength(password) {
  if (!password || String(password).length < 8) {
    return 'Mật khẩu phải có ít nhất 8 ký tự';
  }
  return null;
}
