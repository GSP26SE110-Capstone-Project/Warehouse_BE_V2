import nodemailer from 'nodemailer';

/** Gmail App Password thường dán kèm khoảng trắng — SMTP cần chuỗi liền 16 ký tự. */
function normalizeSmtpPassword(raw) {
  if (raw == null || raw === '') return undefined;
  return String(raw).replace(/\s+/g, '').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function assertMailConfigured() {
  if (!smtpUser || !smtpPass) {
    throw new Error(
      'SMTP credentials missing. Set EMAIL_USER + EMAIL_APP_PASSWORD in .env',
    );
  }
}

export async function sendChangePasswordOtp({ to, fullName, otp, ttlMinutes }) {
  assertMailConfigured();

  const safeName = escapeHtml(fullName || 'bạn');
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937">
      <h2 style="color: #111827">Xác nhận đổi mật khẩu</h2>
      <p>Xin chào <strong>${safeName}</strong>,</p>
      <p>Bạn vừa yêu cầu đổi mật khẩu cho tài khoản Smart Warehouse. Nhập mã OTP bên dưới để xác nhận:</p>
      <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700; color: #111827;
                background: #f3f4f6; padding: 12px 18px; display: inline-block; border-radius: 8px;">
        ${escapeHtml(otp)}
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

/**
 * Email chào mừng Warehouse Admin mới — gửi sau khi System Admin tạo tài khoản.
 */
export async function sendWarehouseAdminWelcomeEmail({
  to,
  fullName,
  email,
  temporaryPassword,
  warehouseName,
  warehouseCode,
  loginUrl,
  resetPasswordUrl,
}) {
  assertMailConfigured();

  const safeName = escapeHtml(fullName || 'Warehouse Admin');
  const safeEmail = escapeHtml(email);
  const safeWarehouse = escapeHtml(
    warehouseName ? `${warehouseName}${warehouseCode ? ` (${warehouseCode})` : ''}` : 'kho được gán',
  );

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px">
      <h2 style="color: #111827">Tài khoản Warehouse Admin</h2>
      <p>Xin chào <strong>${safeName}</strong>,</p>
      <p>Bạn đã được cấp quyền <strong>Warehouse Admin</strong> cho <strong>${safeWarehouse}</strong> trên hệ thống NEXSPACE Smart Warehouse.</p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0">
        <p style="margin: 0 0 8px"><strong>Thông tin đăng nhập</strong></p>
        <p style="margin: 4px 0">Email: <code>${safeEmail}</code></p>
        <p style="margin: 4px 0">Mật khẩu tạm: <code>${escapeHtml(temporaryPassword)}</code></p>
      </div>
      <p>Vì lý do bảo mật, vui lòng <strong>đổi mật khẩu ngay</strong> sau khi đăng nhập lần đầu.</p>
      <p style="margin: 24px 0">
        <a href="${escapeHtml(resetPasswordUrl)}"
           style="display: inline-block; background: #06edf9; color: #0f2223; font-weight: 700;
                  text-decoration: none; padding: 12px 20px; border-radius: 8px">
          Đặt lại mật khẩu
        </a>
      </p>
      <p style="font-size: 14px; color: #4b5563">
        Hoặc đăng nhập tại:
        <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a>
      </p>
      <p style="font-size: 13px; color: #6b7280">Link đặt lại mật khẩu có thời hạn giới hạn. Nếu hết hạn, liên hệ System Admin để được cấp link mới.</p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb" />
      <p style="font-size: 12px; color: #6b7280">NEXSPACE Smart Warehouse — Email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  const text = [
    `Xin chào ${fullName || 'Warehouse Admin'},`,
    '',
    `Bạn đã được cấp quyền Warehouse Admin cho ${warehouseName || 'kho'}.`,
    '',
    'Thông tin đăng nhập:',
    `Email: ${email}`,
    `Mật khẩu tạm: ${temporaryPassword}`,
    '',
    `Đặt lại mật khẩu: ${resetPasswordUrl}`,
    `Đăng nhập: ${loginUrl}`,
  ].join('\n');

  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: 'Tài khoản Warehouse Admin — NEXSPACE Smart Warehouse',
    text,
    html,
  });
}

/**
 * WH Admin — tenant vừa ký hợp đồng, HĐ chuyển ACTIVE.
 */
export async function sendContractSignedByTenantEmail({
  to,
  whAdminName,
  tenantName,
  contractCode,
  contractName,
  warehouseName,
  warehouseCode,
  startDate,
  endDate,
  contractsUrl,
}) {
  assertMailConfigured();

  const safeWhName = escapeHtml(whAdminName || 'Warehouse Admin');
  const safeTenant = escapeHtml(tenantName || 'Tenant');
  const safeCode = escapeHtml(contractCode || '—');
  const safeTitle = escapeHtml(contractName || 'Hợp đồng thuê kho');
  const safeWarehouse = escapeHtml(
    warehouseName ? `${warehouseName}${warehouseCode ? ` (${warehouseCode})` : ''}` : 'kho'
  );

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px">
      <h2 style="color: #111827">Tenant đã ký hợp đồng</h2>
      <p>Xin chào <strong>${safeWhName}</strong>,</p>
      <p>
        <strong>${safeTenant}</strong> vừa ký hợp đồng thuê kho. Hợp đồng đã chuyển sang trạng thái
        <strong style="color: #059669">ACTIVE</strong> — tenant có thể tạo yêu cầu nhập kho.
      </p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0">
        <p style="margin: 0 0 8px"><strong>Thông tin hợp đồng</strong></p>
        <p style="margin: 4px 0">Mã HĐ: <code>${safeCode}</code></p>
        <p style="margin: 4px 0">Tên: ${safeTitle}</p>
        <p style="margin: 4px 0">Kho: ${safeWarehouse}</p>
        <p style="margin: 4px 0">Thời hạn: ${escapeHtml(startDate)} → ${escapeHtml(endDate)}</p>
      </div>
      <p style="margin: 24px 0">
        <a href="${escapeHtml(contractsUrl)}"
           style="display: inline-block; background: #06edf9; color: #0f2223; font-weight: 700;
                  text-decoration: none; padding: 12px 20px; border-radius: 8px">
          Xem quản lý hợp đồng
        </a>
      </p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb" />
      <p style="font-size: 12px; color: #6b7280">NEXSPACE Smart Warehouse — Email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  const text = [
    `Xin chào ${whAdminName || 'Warehouse Admin'},`,
    '',
    `${tenantName || 'Tenant'} vừa ký hợp đồng ${contractCode || ''}. HĐ đã ACTIVE.`,
    '',
    `Kho: ${warehouseName || ''}`,
    `Thời hạn: ${startDate} → ${endDate}`,
    '',
    `Xem hợp đồng: ${contractsUrl}`,
  ].join('\n');

  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `Tenant đã ký HĐ ${contractCode || ''} — NEXSPACE Smart Warehouse`,
    text,
    html,
  });
}

export default transporter;
