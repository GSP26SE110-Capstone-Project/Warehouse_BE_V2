import * as payosPaymentService from '../services/payosPayment.service.js';

/** GET — kiểm tra URL webhook reachable (PayOS / ngrok test). */
export async function webhookPing(req, res) {
  return res.status(200).json({ ok: true, path: '/api/payos/webhook' });
}

/** PayOS gọi POST — không qua auth JWT. Phải trả HTTP 2xx khi chữ ký hợp lệ. */
export async function webhook(req, res) {
  const result = await payosPaymentService.handlePayOSWebhook(req.body);
  return res.status(200).json({ success: true, data: result });
}
