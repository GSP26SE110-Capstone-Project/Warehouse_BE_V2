import AppError from './AppError.js';

const VN_MOBILE_RE = /^0[35789]\d{8}$/;

export function normalizePhoneDigits(value) {
  let digits = String(value).trim().replace(/[\s().-]/g, '');
  if (digits.startsWith('+84')) digits = `0${digits.slice(3)}`;
  else if (/^84[35789]/.test(digits) && digits.length === 11) digits = `0${digits.slice(2)}`;
  return digits;
}

/** Rỗng/null = bỏ qua. Có giá trị thì chuẩn hóa SĐT VN hoặc ném lỗi. */
export function assertOptionalPhone(value, fieldName = 'phone') {
  if (value == null || value === '') return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  if (raw.includes('@')) {
    throw new AppError(`${fieldName} must not be an email address`, 400, 'VALIDATION_ERROR');
  }
  const normalized = normalizePhoneDigits(raw);
  if (!VN_MOBILE_RE.test(normalized)) {
    throw new AppError(`${fieldName} is invalid`, 400, 'VALIDATION_ERROR');
  }
  return normalized;
}
