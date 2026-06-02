/**
 * Đăng ký / cập nhật webhook PayOS cho kênh thanh toán (dev ngrok).
 *
 * Cần trong .env:
 *   PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY
 *   PAYOS_WEBHOOK_PUBLIC_URL=https://xxxx.ngrok-free.app  (không slash cuối)
 *
 * Chạy: npm run payos:confirm-webhook
 */
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const { getPayOSClient, isPayOSConfigured } = await import('../src/config/payos.js');

function buildWebhookUrl() {
  const base = String(process.env.PAYOS_WEBHOOK_PUBLIC_URL ?? '').trim().replace(/\/$/, '');
  if (!base) {
    console.error(
      '\nThiếu PAYOS_WEBHOOK_PUBLIC_URL trong .env\n' +
        'Ví dụ: PAYOS_WEBHOOK_PUBLIC_URL=https://a1b2c3d4.ngrok-free.app\n' +
        '(URL HTTPS từ lệnh: ngrok http 3000)\n'
    );
    process.exit(1);
  }
  if (!base.startsWith('https://')) {
    console.error('PAYOS_WEBHOOK_PUBLIC_URL phải bắt đầu bằng https://');
    process.exit(1);
  }
  return `${base}/api/payos/webhook`;
}

async function main() {
  if (!isPayOSConfigured()) {
    console.error('Thiếu PAYOS_CLIENT_ID / PAYOS_API_KEY / PAYOS_CHECKSUM_KEY trong .env');
    process.exit(1);
  }

  const webhookUrl = buildWebhookUrl();
  console.log('Đăng ký webhook PayOS:', webhookUrl);
  console.log('(BE + ngrok phải đang chạy)\n');

  try {
    const ping = await fetch(webhookUrl.replace(/\/webhook$/, '/webhook'), {
      method: 'GET',
    });
    console.log(`GET webhook → HTTP ${ping.status}`);
    if (ping.status === 404) {
      console.error(
        '404 qua ngrok — bật lại ngrok http 3000, cập nhật PAYOS_WEBHOOK_PUBLIC_URL, restart BE'
      );
      process.exit(1);
    }
  } catch (e) {
    console.warn('Không GET được webhook qua public URL:', e.message);
  }

  console.log('Gợi ý: npm run payos:test-webhook\n');

  const payos = getPayOSClient();
  const result = await payos.webhooks.confirm(webhookUrl);

  console.log('Thành công:', JSON.stringify(result, null, 2));
  console.log('\nTiếp theo: test Thanh toán PayOS trên FE → HĐ chuyển ACTIVE sau webhook.');
}

main().catch((err) => {
  console.error('Lỗi:', err?.message ?? err);
  if (err?.response?.data) console.error('PayOS:', err.response.data);
  process.exit(1);
});
