import { PayOS } from '@payos/node';
import AppError from '../utils/AppError.js';

let client = null;

export function isPayOSConfigured() {
  return Boolean(
    process.env.PAYOS_CLIENT_ID &&
      process.env.PAYOS_API_KEY &&
      process.env.PAYOS_CHECKSUM_KEY
  );
}

function trimEnv(name) {
  return String(process.env[name] ?? '').trim();
}

export function getPayOSClient() {
  if (!isPayOSConfigured()) {
    throw new AppError(
      'PayOS chưa cấu hình (PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY)',
      503,
      'PAYOS_NOT_CONFIGURED'
    );
  }
  if (!client) {
    client = new PayOS({
      clientId: trimEnv('PAYOS_CLIENT_ID'),
      apiKey: trimEnv('PAYOS_API_KEY'),
      checksumKey: trimEnv('PAYOS_CHECKSUM_KEY'),
    });
  }
  return client;
}

/** URL FE — tenant quay lại sau thanh toán / hủy. */
export function getPayOSFrontendOrigin() {
  return (
    process.env.PAYOS_RETURN_ORIGIN ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173'
  ).replace(/\/$/, '');
}

/**
 * Dev/test: số tiền gửi lên PayOS (invoice DB vẫn giữ totalAmount thật).
 * Chỉ áp dụng khi NODE_ENV !== 'production' và PAYOS_DEV_AMOUNT >= 1000.
 */
export function resolvePayOSCheckoutAmount(invoiceTotalAmount) {
  const invoiceAmount = Math.round(Number(invoiceTotalAmount) || 0);
  const isProd = process.env.NODE_ENV === 'production';
  const raw = String(process.env.PAYOS_DEV_AMOUNT ?? '').trim();

  if (!isProd && raw !== '') {
    const devAmount = Math.round(Number(raw));
    if (Number.isFinite(devAmount) && devAmount >= 1000) {
      return { payosAmount: devAmount, invoiceAmount, devMode: true };
    }
  }

  return { payosAmount: invoiceAmount, invoiceAmount, devMode: false };
}
