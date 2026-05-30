/** Base URL frontend (không slash cuối) — dùng trong email link. */
export function getFrontendBaseUrl() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5173';
  return String(raw).replace(/\/+$/, '');
}

export function buildPasswordResetUrl(token) {
  const base = getFrontendBaseUrl();
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

export function buildLoginUrl() {
  return `${getFrontendBaseUrl()}/login`;
}

export function buildAdminContractsUrl() {
  return `${getFrontendBaseUrl()}/admin/contract`;
}
