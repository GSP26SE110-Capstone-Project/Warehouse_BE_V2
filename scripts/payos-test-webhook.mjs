/**
 * Kiểm tra webhook PayOS: tunnel + chữ ký CHECKSUM_KEY.
 * Chạy: npm run payos:test-webhook
 */
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const { getPayOSClient, isPayOSConfigured } = await import('../src/config/payos.js');

const SAMPLE_DATA = {
  orderCode: 123,
  amount: 3000,
  description: 'VQRIO123',
  accountNumber: '12345678',
  reference: 'TF230204212323',
  transactionDateTime: '2023-02-04 18:25:00',
  currency: 'VND',
  paymentLinkId: 'test-payment-link-id',
  code: '00',
  desc: 'Thành công',
  counterAccountBankId: '',
  counterAccountBankName: '',
  counterAccountName: '',
  counterAccountNumber: '',
  virtualAccountName: '',
  virtualAccountNumber: '',
};

async function buildSignedPayload(payos) {
  const signature = await payos.crypto.createSignatureFromObj(
    SAMPLE_DATA,
    payos.checksumKey
  );
  return {
    code: '00',
    desc: 'success',
    success: true,
    data: SAMPLE_DATA,
    signature,
  };
}

async function probeUrl(label, url, payload) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
    });
    const text = await res.text();
    console.log(`[${label}] ${url}`);
    console.log(`  HTTP ${res.status} — ${text.slice(0, 200)}`);
    return res.status;
  } catch (err) {
    console.log(`[${label}] ${url}`);
    console.log(`  Lỗi: ${err.message}`);
    return 0;
  }
}

async function main() {
  if (!isPayOSConfigured()) {
    console.error('Thiếu PAYOS_* trong .env');
    process.exit(1);
  }

  const payos = getPayOSClient();
  const signed = await buildSignedPayload(payos);
  const localUrl = 'http://127.0.0.1:3000/api/payos/webhook';
  const base = String(process.env.PAYOS_WEBHOOK_PUBLIC_URL ?? '').trim().replace(/\/$/, '');
  const publicUrl = base ? `${base}/api/payos/webhook` : null;

  console.log('--- 1) POST rỗng (phải 400, không được 404) ---');
  const emptyStatus = await probeUrl('local-empty', localUrl, {});
  if (emptyStatus === 404) {
    console.error('\n404 = BE chưa có route / chưa restart npm run dev');
    process.exit(1);
  }

  console.log('\n--- 2) POST có chữ ký đúng (phải 200) ---');
  const signedStatus = await probeUrl('local-signed', localUrl, signed);
  if (signedStatus !== 200) {
    console.error('\nKhông 200 = CHECKSUM_KEY sai hoặc logic webhook lỗi');
    process.exit(1);
  }

  if (publicUrl) {
    console.log('\n--- 3) Qua ngrok/public URL ---');
    await probeUrl('public-empty', publicUrl, {});
    const pubSigned = await probeUrl('public-signed', publicUrl, signed);
    if (pubSigned === 404) {
      console.error('\n404 qua ngrok = tắt ngrok hoặc URL .env sai. Chạy: ngrok http 3000');
      process.exit(1);
    }
    if (pubSigned !== 200) {
      console.error('\nKhông 200 qua ngrok — PayOS confirm-webhook sẽ fail');
      process.exit(1);
    }
  } else {
    console.log('\n(Bỏ qua bước 3 — chưa có PAYOS_WEBHOOK_PUBLIC_URL)');
  }

  console.log('\nOK — webhook local (và public nếu có) hoạt động. Chạy: npm run payos:confirm-webhook');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
