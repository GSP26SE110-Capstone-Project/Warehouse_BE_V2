import nodemailer from 'nodemailer';

/** Gmail App Password thường dán kèm khoảng trắng — SMTP cần chuỗi liền 16 ký tự. */
function normalizeSmtpPassword(raw) {
  if (raw == null || raw === '') return undefined;
  return String(raw).replace(/\s+/g, '').trim();
}

const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
const smtpPass = normalizeSmtpPassword(
  process.env.SMTP_PASS || process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD,
);

const smtpHost =
  process.env.SMTP_HOST ||
  (String(process.env.EMAIL_SERVICE || '').toLowerCase() === 'gmail' ? 'smtp.gmail.com' : undefined);

const transporter = nodemailer.createTransport({
  host: smtpHost || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  ...(smtpUser && smtpPass ? { auth: { user: smtpUser, pass: smtpPass } } : {}),
});

const FROM_ADDRESS =
  process.env.MAIL_FROM || smtpUser || 'no-reply@warehouse.local';

export async function sendChangePasswordOtp({ to, fullName, otp, ttlMinutes }) {
  if (!smtpUser || !smtpPass) {
    throw new Error(
      'SMTP credentials missing. Set EMAIL_USER + EMAIL_APP_PASSWORD in .env',
    );
  }

  const safeName = fullName || 'bạn';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937">
      <h2 style="color: #111827">Xác nhận đổi mật khẩu</h2>
      <p>Xin chào <strong>${safeName}</strong>,</p>
      <p>Bạn vừa yêu cầu đổi mật khẩu cho tài khoản Smart Warehouse. Nhập mã OTP bên dưới để xác nhận:</p>
      <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700; color: #111827;
                background: #f3f4f6; padding: 12px 18px; display: inline-block; border-radius: 8px;">
        ${otp}
      </p>
      <p>Mã có hiệu lực trong <strong>${ttlMinutes} phút</strong>. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb" />
      <p style="font-size: 12px; color: #6b7280">Smart Warehouse — Đây là email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: 'Mã OTP đổi mật khẩu — Smart Warehouse',
    text: `Mã OTP đổi mật khẩu của bạn là: ${otp} (hết hạn sau ${ttlMinutes} phút).`,
    html,
  });
}

export default transporter;
