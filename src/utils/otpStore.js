import crypto from 'crypto';

/**
 * In-memory OTP store theo `userId`.
 * Mỗi entry có TTL; expired sẽ bị tự dọn khi truy vấn.
 *
 * Không cần persist xuyên qua restart — pending forgot-password chấp nhận mất nếu BE restart.
 */
const store = new Map();

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

export function generateOtp(length = 6) {
  const max = 10 ** length;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(length, '0');
}

/**
 * @param {string} userId
 * @param {object} options
 * @param {string} options.otp         Plain OTP (sẽ được hash trước khi lưu)
 * @param {number} options.ttlMs       Thời gian hết hạn (ms)
 * @param {object} options.payload     Dữ liệu kèm theo (vd: newPasswordHash)
 */
export function saveOtp(userId, { otp, ttlMs, payload }) {
  store.set(userId, {
    otpHash: hashOtp(otp),
    expiresAt: Date.now() + ttlMs,
    attemptsLeft: 5,
    payload,
  });
}

/**
 * Trả về `{ ok: true, payload }` nếu OTP đúng và còn hạn, ngược lại
 * `{ ok: false, reason: 'NOT_FOUND' | 'EXPIRED' | 'MISMATCH' | 'LOCKED', attemptsLeft? }`.
 *
 * Khi đúng → tự xoá entry để OTP single-use.
 */
export function verifyOtp(userId, otp) {
  const entry = store.get(userId);
  if (!entry) return { ok: false, reason: 'NOT_FOUND' };

  if (Date.now() > entry.expiresAt) {
    store.delete(userId);
    return { ok: false, reason: 'EXPIRED' };
  }

  if (entry.attemptsLeft <= 0) {
    store.delete(userId);
    return { ok: false, reason: 'LOCKED' };
  }

  if (hashOtp(otp) !== entry.otpHash) {
    entry.attemptsLeft -= 1;
    if (entry.attemptsLeft <= 0) {
      store.delete(userId);
      return { ok: false, reason: 'LOCKED' };
    }
    return { ok: false, reason: 'MISMATCH', attemptsLeft: entry.attemptsLeft };
  }

  const { payload } = entry;
  store.delete(userId);
  return { ok: true, payload };
}

export function clearOtp(userId) {
  store.delete(userId);
}
