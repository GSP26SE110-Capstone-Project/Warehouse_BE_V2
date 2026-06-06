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
      <h2 style="color: #111827">Đặt lại mật khẩu</h2>
      <p>Xin chào <strong>${safeName}</strong>,</p>
      <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản NEXSPACE Smart Warehouse. Nhập mã OTP bên dưới để xác nhận:</p>
      <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700; color: #111827;
                background: #f3f4f6; padding: 12px 18px; display: inline-block; border-radius: 8px;">
        ${escapeHtml(otp)}
      </p>
      <p>Mã có hiệu lực trong <strong>${ttlMinutes} phút</strong>. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email — mật khẩu của bạn sẽ không thay đổi.</p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb" />
      <p style="font-size: 12px; color: #6b7280">NEXSPACE Smart Warehouse — Đây là email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: 'Mã OTP đặt lại mật khẩu — NEXSPACE Smart Warehouse',
    text: `Mã OTP đặt lại mật khẩu của bạn là: ${otp} (hết hạn sau ${ttlMinutes} phút). Nếu không phải bạn yêu cầu, hãy bỏ qua email này.`,
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
 * Email chào mừng nhân viên kho / tài xế — gửi sau khi WH Admin tạo tài khoản.
 */
async function sendWarehouseMemberWelcomeEmail({
  to,
  fullName,
  email,
  temporaryPassword,
  warehouseName,
  warehouseCode,
  loginUrl,
  resetPasswordUrl,
  roleTitle,
  roleDescription,
  subject,
  defaultName,
  supportContactLabel,
}) {
  assertMailConfigured();

  const safeName = escapeHtml(fullName || defaultName);
  const safeEmail = escapeHtml(email);
  const safeWarehouse = escapeHtml(
    warehouseName ? `${warehouseName}${warehouseCode ? ` (${warehouseCode})` : ''}` : 'kho được gán',
  );

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px">
      <h2 style="color: #111827">Tài khoản ${escapeHtml(roleTitle)}</h2>
      <p>Xin chào <strong>${safeName}</strong>,</p>
      <p>Bạn đã được cấp quyền <strong>${escapeHtml(roleTitle)}</strong> cho <strong>${safeWarehouse}</strong> trên hệ thống NEXSPACE Smart Warehouse — ${escapeHtml(roleDescription)}.</p>
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
      <p style="font-size: 13px; color: #6b7280">Link đặt lại mật khẩu có thời hạn giới hạn. Nếu hết hạn, liên hệ ${escapeHtml(supportContactLabel)} để được cấp link mới.</p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb" />
      <p style="font-size: 12px; color: #6b7280">NEXSPACE Smart Warehouse — Email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  const text = [
    `Xin chào ${fullName || defaultName},`,
    '',
    `Bạn đã được cấp quyền ${roleTitle} cho ${warehouseName || 'kho'}.`,
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
    subject,
    text,
    html,
  });
}

/** WH Admin tạo WH_STAFF — welcome email kèm mật khẩu tạm và link reset. */
export async function sendWarehouseStaffWelcomeEmail(params) {
  return sendWarehouseMemberWelcomeEmail({
    ...params,
    roleTitle: 'Warehouse Staff',
    roleDescription: 'nhận hàng, putaway, picking/xuất kho và tra cứu tồn kho',
    subject: 'Tài khoản Warehouse Staff — NEXSPACE Smart Warehouse',
    defaultName: 'Warehouse Staff',
    supportContactLabel: 'Warehouse Admin',
  });
}

/** WH Admin tạo WH_TRANSPORTER — welcome email kèm mật khẩu tạm và link reset. */
export async function sendWarehouseTransporterWelcomeEmail(params) {
  return sendWarehouseMemberWelcomeEmail({
    ...params,
    roleTitle: 'Warehouse Transporter',
    roleDescription: 'xem chuyến giao hàng được gán và báo xe đến kho',
    subject: 'Tài khoản Tài xế kho — NEXSPACE Smart Warehouse',
    defaultName: 'Tài xế kho',
    supportContactLabel: 'Warehouse Admin',
  });
}

/**
 * Email chào mừng Tenant Admin mới — gửi sau khi System Admin tạo tài khoản.
 */
export async function sendTenantAdminWelcomeEmail({
  to,
  fullName,
  email,
  temporaryPassword,
  tenantName,
  tenantCode,
  loginUrl,
  resetPasswordUrl,
}) {
  assertMailConfigured();

  const safeName = escapeHtml(fullName || 'Tenant Admin');
  const safeEmail = escapeHtml(email);
  const safeTenant = escapeHtml(
    tenantName ? `${tenantName}${tenantCode ? ` (${tenantCode})` : ''}` : 'doanh nghiệp của bạn',
  );

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px">
      <h2 style="color: #111827">Tài khoản Tenant Admin</h2>
      <p>Xin chào <strong>${safeName}</strong>,</p>
      <p>Bạn đã được cấp quyền <strong>Tenant Admin</strong> cho <strong>${safeTenant}</strong> trên hệ thống NEXSPACE Smart Warehouse — quản lý hợp đồng thuê kho, sản phẩm (SKU), yêu cầu nhập/xuất kho và nhân viên tenant.</p>
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
        Hoặc đăng nhập trực tiếp tại:
        <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a>
      </p>
      <p style="font-size: 13px; color: #6b7280">Link đặt lại mật khẩu có thời hạn giới hạn. Nếu hết hạn, liên hệ System Admin để được cấp link mới.</p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb" />
      <p style="font-size: 12px; color: #6b7280">NEXSPACE Smart Warehouse — Email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  const text = [
    `Xin chào ${fullName || 'Tenant Admin'},`,
    '',
    `Bạn đã được cấp quyền Tenant Admin cho ${tenantName || 'doanh nghiệp'}.`,
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
    subject: 'Tài khoản Tenant Admin — NEXSPACE Smart Warehouse',
    text,
    html,
  });
}

/**
 * WH Admin — tenant vừa ký hợp đồng, chờ thanh toán invoice đầu.
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
        <strong style="color: #d97706">Chờ thanh toán invoice đầu</strong> — sau khi trả, HĐ ACTIVE và mở inbound.
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
    `${tenantName || 'Tenant'} vừa ký hợp đồng ${contractCode || ''}. Chờ thanh toán invoice đầu (PENDING_PAYMENT).`,
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

/**
 * Tenant admin — HĐ đã cấp chỗ, chờ ký (PENDING_APPROVAL).
 */
export async function sendContractPendingApprovalEmail({
  to,
  tenantAdminName,
  companyName,
  contractCode,
  contractName,
  warehouseName,
  warehouseCode,
  startDate,
  endDate,
  datesShiftNote,
  contractsUrl,
}) {
  assertMailConfigured();

  const safeName = escapeHtml(tenantAdminName || 'Tenant Admin');
  const safeCompany = escapeHtml(companyName || '—');
  const safeCode = escapeHtml(contractCode || '—');
  const safeTitle = escapeHtml(contractName || 'Hợp đồng thuê kho');
  const safeWarehouse = escapeHtml(
    warehouseName ? `${warehouseName}${warehouseCode ? ` (${warehouseCode})` : ''}` : '—'
  );
  const shiftBlock = datesShiftNote
    ? `<p style="margin: 12px 0 0; padding: 12px; background: #fffbeb; border-radius: 6px; color: #92400e; font-size: 13px">${escapeHtml(datesShiftNote)}</p>`
    : '';

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px">
      <h2 style="color: #111827">Hợp đồng sẵn sàng để ký</h2>
      <p>Xin chào <strong>${safeName}</strong>,</p>
      <p>
        Kho đã cấp vị trí lưu trữ cho <strong>${safeTitle}</strong> (${safeCode}) của
        <strong>${safeCompany}</strong>. Vui lòng đăng nhập để xem chi tiết và ký hợp đồng.
      </p>
      <div style="background: #ecfdf5; border-radius: 8px; padding: 16px; margin: 20px 0">
        <p style="margin: 0 0 8px"><strong>Thông tin hợp đồng</strong></p>
        <p style="margin: 4px 0">Mã HĐ: <code>${safeCode}</code></p>
        <p style="margin: 4px 0">Kho: ${safeWarehouse}</p>
        <p style="margin: 4px 0">Thời hạn: ${escapeHtml(startDate)} → ${escapeHtml(endDate)}</p>
        ${shiftBlock}
      </div>
      <p style="margin: 24px 0">
        <a href="${escapeHtml(contractsUrl)}"
           style="display: inline-block; background: #06edf9; color: #0f2223; font-weight: 700;
                  text-decoration: none; padding: 12px 20px; border-radius: 8px">
          Xem &amp; ký hợp đồng
        </a>
      </p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb" />
      <p style="font-size: 12px; color: #6b7280">NEXSPACE Smart Warehouse — Email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  const text = [
    `Xin chào ${tenantAdminName || 'Tenant Admin'},`,
    '',
    `Hợp đồng ${contractCode} đã sẵn sàng để ký.`,
    `Kho: ${warehouseName || '—'}. Thời hạn: ${startDate} → ${endDate}.`,
    datesShiftNote ? `\n${datesShiftNote}\n` : '',
    contractsUrl,
  ]
    .filter(Boolean)
    .join('\n');

  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `Hợp đồng ${contractCode} chờ bạn ký — NEXSPACE Smart Warehouse`,
    text,
    html,
  });
}

/**
 * WH Admin — tenant đã thanh toán invoice đầu (PayOS), HĐ ACTIVE.
 */
export async function sendContractInitialPaymentReceivedEmail({
  to,
  whAdminName,
  tenantName,
  contractCode,
  contractName,
  warehouseName,
  warehouseCode,
  invoiceCode,
  amountPaid,
  paidAt,
  contractsUrl,
}) {
  assertMailConfigured();

  const safeWhName = escapeHtml(whAdminName || 'Warehouse Admin');
  const safeTenant = escapeHtml(tenantName || 'Tenant');
  const safeCode = escapeHtml(contractCode || '—');
  const safeTitle = escapeHtml(contractName || 'Hợp đồng thuê kho');
  const safeInvoice = escapeHtml(invoiceCode || '—');
  const safeAmount = escapeHtml(amountPaid || '—');
  const safePaidAt = escapeHtml(paidAt || '—');
  const safeWarehouse = escapeHtml(
    warehouseName ? `${warehouseName}${warehouseCode ? ` (${warehouseCode})` : ''}` : 'kho'
  );

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px">
      <h2 style="color: #111827">Tenant đã thanh toán invoice đầu</h2>
      <p>Xin chào <strong>${safeWhName}</strong>,</p>
      <p>
        <strong>${safeTenant}</strong> vừa thanh toán thành công invoice đầu qua PayOS.
        Hợp đồng đã chuyển sang <strong style="color: #059669">ACTIVE</strong> — tenant có thể tạo yêu cầu nhập kho.
      </p>
      <div style="background: #ecfdf5; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #a7f3d0">
        <p style="margin: 0 0 8px"><strong>Chi tiết thanh toán</strong></p>
        <p style="margin: 4px 0">Mã HĐ: <code>${safeCode}</code></p>
        <p style="margin: 4px 0">Tên: ${safeTitle}</p>
        <p style="margin: 4px 0">Kho: ${safeWarehouse}</p>
        <p style="margin: 4px 0">Invoice: <code>${safeInvoice}</code></p>
        <p style="margin: 4px 0">Số tiền: <strong>${safeAmount}</strong></p>
        <p style="margin: 4px 0">Thời điểm: ${safePaidAt}</p>
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
    `${tenantName || 'Tenant'} đã thanh toán invoice đầu cho HĐ ${contractCode || ''}. HĐ đã ACTIVE.`,
    '',
    `Invoice: ${invoiceCode || ''}`,
    `Số tiền: ${amountPaid || ''}`,
    `Thời điểm: ${paidAt || ''}`,
    '',
    `Xem hợp đồng: ${contractsUrl}`,
  ].join('\n');

  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `Đã thanh toán HĐ ${contractCode || ''} — HĐ ACTIVE — NEXSPACE`,
    text,
    html,
  });
}

/** Tenant admin — kho đã gán tài xế cho inbound (kho đi lấy hàng). */
export async function sendInboundTransportAssignedEmail({
  to,
  tenantAdminName,
  inboundCode,
  expectedArrivalDate,
  driverName,
  driverPhone,
  vehiclePlate,
  pickupAddress,
  pickupContactName,
  pickupContactPhone,
  warehouseName,
  warehouseAddress,
  inboundUrl,
}) {
  assertMailConfigured();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px">
      <h2 style="color: #111827">Kho đã gán tài xế lấy hàng</h2>
      <p>Xin chào <strong>${escapeHtml(tenantAdminName || 'Tenant Admin')}</strong>,</p>
      <p>
        Yêu cầu nhập kho <strong>${escapeHtml(inboundCode)}</strong> đã có tài xế kho được gán.
        Tài xế sẽ đến điểm lấy hàng theo thông tin bạn đã cung cấp.
      </p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0">
        <p style="margin: 0 0 8px"><strong>Tài xế / xe</strong></p>
        <p style="margin: 4px 0">Tài xế: ${escapeHtml(driverName)}</p>
        <p style="margin: 4px 0">SĐT: ${escapeHtml(driverPhone)}</p>
        <p style="margin: 4px 0">Biển số: ${escapeHtml(vehiclePlate)}</p>
        <p style="margin: 4px 0">Dự kiến: ${escapeHtml(expectedArrivalDate)}</p>
      </div>
      <div style="background: #ecfdf5; border-radius: 8px; padding: 16px; margin: 20px 0">
        <p style="margin: 0 0 8px"><strong>Điểm lấy hàng (của bạn)</strong></p>
        <p style="margin: 4px 0">${escapeHtml(pickupAddress)}</p>
        <p style="margin: 4px 0">Liên hệ: ${escapeHtml(pickupContactName)} · ${escapeHtml(pickupContactPhone)}</p>
      </div>
      <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 20px 0">
        <p style="margin: 0 0 8px"><strong>Đích — kho nhận hàng</strong></p>
        <p style="margin: 4px 0">${escapeHtml(warehouseName)}</p>
        <p style="margin: 4px 0">${escapeHtml(warehouseAddress || '—')}</p>
      </div>
      <p style="margin: 24px 0">
        <a href="${escapeHtml(inboundUrl)}"
           style="display: inline-block; background: #06edf9; color: #0f2223; font-weight: 700;
                  text-decoration: none; padding: 12px 20px; border-radius: 8px">
          Xem chi tiết inbound
        </a>
      </p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb" />
      <p style="font-size: 12px; color: #6b7280">NEXSPACE Smart Warehouse — Email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  const text = [
    `Xin chào ${tenantAdminName || 'Tenant Admin'},`,
    '',
    `Inbound ${inboundCode} đã được gán tài xế: ${driverName}, ${driverPhone}, biển số ${vehiclePlate}.`,
    `Điểm lấy: ${pickupAddress}. Liên hệ: ${pickupContactName} ${pickupContactPhone}.`,
    `Kho đích: ${warehouseName} — ${warehouseAddress || ''}.`,
    '',
    inboundUrl,
  ].join('\n');

  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `Đã gán tài xế cho ${inboundCode} — NEXSPACE Smart Warehouse`,
    text,
    html,
  });
}

/** WH Admin — tài xế báo xe đã đến cổng kho (inbound kho đi lấy). */
export async function sendInboundArrivalWhAdminEmail({
  to,
  whAdminName,
  inboundCode,
  actualArrivalAt,
  driverName,
  driverPhone,
  vehiclePlate,
  companyName,
  warehouseName,
  inboundUrl,
}) {
  assertMailConfigured();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px">
      <h2 style="color: #111827">Xe đã đến cổng kho</h2>
      <p>Xin chào <strong>${escapeHtml(whAdminName || 'WH Admin')}</strong>,</p>
      <p>
        Tài xế đã báo xe tới kho cho inbound <strong>${escapeHtml(inboundCode)}</strong>
        (tenant: ${escapeHtml(companyName)}).
        Bạn có thể chuyển sang bước nhận hàng.
      </p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0">
        <p style="margin: 4px 0">Thời điểm: ${escapeHtml(actualArrivalAt)}</p>
        <p style="margin: 4px 0">Tài xế: ${escapeHtml(driverName)} · ${escapeHtml(driverPhone)}</p>
        <p style="margin: 4px 0">Biển số: ${escapeHtml(vehiclePlate)}</p>
        <p style="margin: 4px 0">Kho: ${escapeHtml(warehouseName)}</p>
      </div>
      <p style="margin: 24px 0">
        <a href="${escapeHtml(inboundUrl)}"
           style="display: inline-block; background: #06edf9; color: #0f2223; font-weight: 700;
                  text-decoration: none; padding: 12px 20px; border-radius: 8px">
          Xem inbound
        </a>
      </p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb" />
      <p style="font-size: 12px; color: #6b7280">NEXSPACE Smart Warehouse — Email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  const text = [
    `Xe đã đến kho — inbound ${inboundCode} (${companyName}).`,
    `Thời điểm: ${actualArrivalAt}. Tài xế: ${driverName}, ${driverPhone}, biển số ${vehiclePlate}.`,
    inboundUrl,
  ].join('\n');

  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `Xe đã đến kho — ${inboundCode}`,
    text,
    html,
  });
}

/** Tenant admin — hàng đã tới cổng kho (tài xế kho báo đến). */
export async function sendInboundArrivalTenantEmail({
  to,
  tenantAdminName,
  inboundCode,
  actualArrivalAt,
  driverName,
  vehiclePlate,
  warehouseName,
  warehouseAddress,
  inboundUrl,
}) {
  assertMailConfigured();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px">
      <h2 style="color: #111827">Hàng đã tới kho</h2>
      <p>Xin chào <strong>${escapeHtml(tenantAdminName || 'Tenant Admin')}</strong>,</p>
      <p>
        Tài xế kho đã báo xe mang hàng inbound <strong>${escapeHtml(inboundCode)}</strong>
        đã tới cổng kho. Kho sẽ tiến hành nhận và kiểm đếm.
      </p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0">
        <p style="margin: 4px 0">Thời điểm: ${escapeHtml(actualArrivalAt)}</p>
        <p style="margin: 4px 0">Tài xế: ${escapeHtml(driverName)} · ${escapeHtml(vehiclePlate)}</p>
        <p style="margin: 4px 0">Kho: ${escapeHtml(warehouseName)}</p>
        <p style="margin: 4px 0">${escapeHtml(warehouseAddress || '—')}</p>
      </div>
      <p style="margin: 24px 0">
        <a href="${escapeHtml(inboundUrl)}"
           style="display: inline-block; background: #06edf9; color: #0f2223; font-weight: 700;
                  text-decoration: none; padding: 12px 20px; border-radius: 8px">
          Xem chi tiết inbound
        </a>
      </p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb" />
      <p style="font-size: 12px; color: #6b7280">NEXSPACE Smart Warehouse — Email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  const text = [
    `Hàng inbound ${inboundCode} đã tới kho lúc ${actualArrivalAt}.`,
    `Tài xế: ${driverName}, biển số ${vehiclePlate}. Kho: ${warehouseName}.`,
    inboundUrl,
  ].join('\n');

  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `Hàng đã tới kho — ${inboundCode}`,
    text,
    html,
  });
}

/** WH Admin — tài xế đã lấy hàng tại tenant, đang về kho. */
export async function sendInboundPickupWhAdminEmail({
  to,
  whAdminName,
  inboundCode,
  actualPickupAt,
  driverName,
  driverPhone,
  vehiclePlate,
  companyName,
  pickupAddress,
  inboundUrl,
}) {
  assertMailConfigured();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px">
      <h2 style="color: #111827">Tài xế đã lấy hàng</h2>
      <p>Xin chào <strong>${escapeHtml(whAdminName || 'WH Admin')}</strong>,</p>
      <p>
        Tài xế đã báo <strong>đã lấy hàng</strong> cho inbound <strong>${escapeHtml(inboundCode)}</strong>
        (tenant: ${escapeHtml(companyName)}). Xe đang về kho.
      </p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0">
        <p style="margin: 4px 0">Thời điểm lấy hàng: ${escapeHtml(actualPickupAt)}</p>
        <p style="margin: 4px 0">Điểm lấy: ${escapeHtml(pickupAddress)}</p>
        <p style="margin: 4px 0">Tài xế: ${escapeHtml(driverName)} · ${escapeHtml(driverPhone)}</p>
        <p style="margin: 4px 0">Biển số: ${escapeHtml(vehiclePlate)}</p>
      </div>
      <p style="margin: 24px 0">
        <a href="${escapeHtml(inboundUrl)}"
           style="display: inline-block; background: #06edf9; color: #0f2223; font-weight: 700;
                  text-decoration: none; padding: 12px 20px; border-radius: 8px">
          Xem inbound
        </a>
      </p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb" />
      <p style="font-size: 12px; color: #6b7280">NEXSPACE Smart Warehouse — Email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  const text = [
    `Tài xế đã lấy hàng — inbound ${inboundCode} (${companyName}).`,
    `Thời điểm: ${actualPickupAt}. Điểm lấy: ${pickupAddress}.`,
    `Tài xế: ${driverName}, ${driverPhone}, biển số ${vehiclePlate}.`,
    inboundUrl,
  ].join('\n');

  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `Đã lấy hàng — ${inboundCode}`,
    text,
    html,
  });
}

/** Tenant admin — tài xế kho đã lấy hàng tại địa điểm tenant. */
export async function sendInboundPickupTenantEmail({
  to,
  tenantAdminName,
  inboundCode,
  actualPickupAt,
  driverName,
  vehiclePlate,
  pickupAddress,
  warehouseName,
  inboundUrl,
}) {
  assertMailConfigured();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px">
      <h2 style="color: #111827">Tài xế đã lấy hàng</h2>
      <p>Xin chào <strong>${escapeHtml(tenantAdminName || 'Tenant Admin')}</strong>,</p>
      <p>
        Tài xế kho đã báo <strong>đã lấy hàng</strong> cho inbound <strong>${escapeHtml(inboundCode)}</strong>
        tại điểm lấy của bạn. Hàng đang được vận chuyển về kho <strong>${escapeHtml(warehouseName)}</strong>.
      </p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0">
        <p style="margin: 4px 0">Thời điểm: ${escapeHtml(actualPickupAt)}</p>
        <p style="margin: 4px 0">Điểm lấy: ${escapeHtml(pickupAddress)}</p>
        <p style="margin: 4px 0">Tài xế: ${escapeHtml(driverName)} · ${escapeHtml(vehiclePlate)}</p>
      </div>
      <p style="margin: 24px 0">
        <a href="${escapeHtml(inboundUrl)}"
           style="display: inline-block; background: #06edf9; color: #0f2223; font-weight: 700;
                  text-decoration: none; padding: 12px 20px; border-radius: 8px">
          Xem chi tiết inbound
        </a>
      </p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb" />
      <p style="font-size: 12px; color: #6b7280">NEXSPACE Smart Warehouse — Email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  const text = [
    `Tài xế đã lấy hàng inbound ${inboundCode} lúc ${actualPickupAt}.`,
    `Điểm lấy: ${pickupAddress}. Tài xế: ${driverName}, biển số ${vehiclePlate}.`,
    `Đang về kho: ${warehouseName}.`,
    inboundUrl,
  ].join('\n');

  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `Tài xế đã lấy hàng — ${inboundCode}`,
    text,
    html,
  });
}

/** WH Staff — được gán pick phiếu xuất. */
export async function sendOutboundPickerAssignedEmail({
  to,
  pickerName,
  outboundCode,
  requestedShipDate,
  companyName,
  warehouseName,
  outboundUrl,
}) {
  assertMailConfigured();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px">
      <h2 style="color: #111827">Bạn được gán pick phiếu xuất</h2>
      <p>Xin chào <strong>${escapeHtml(pickerName || 'Nhân viên kho')}</strong>,</p>
      <p>
        Quản trị kho đã gán bạn thực hiện picking cho phiếu
        <strong>${escapeHtml(outboundCode)}</strong>.
      </p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0">
        <p style="margin: 4px 0">Tenant: ${escapeHtml(companyName)}</p>
        <p style="margin: 4px 0">Kho: ${escapeHtml(warehouseName)}</p>
        <p style="margin: 4px 0">Ngày xuất dự kiến: ${escapeHtml(requestedShipDate)}</p>
      </div>
      <p style="margin: 24px 0">
        <a href="${escapeHtml(outboundUrl)}"
           style="display: inline-block; background: #f97316; color: #0f2223; font-weight: 700;
                  text-decoration: none; padding: 12px 20px; border-radius: 8px">
          Mở phiếu pick
        </a>
      </p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb" />
      <p style="font-size: 12px; color: #6b7280">NEXSPACE Smart Warehouse — Email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  const text = [
    `Bạn được gán pick phiếu ${outboundCode}.`,
    `Tenant: ${companyName}. Kho: ${warehouseName}.`,
    `Ngày xuất dự kiến: ${requestedShipDate}.`,
    outboundUrl,
  ].join('\n');

  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `Gán pick — ${outboundCode}`,
    text,
    html,
  });
}

/** WH_TRANSPORTER — được gán giao outbound sau SHIPPED. */
export async function sendOutboundTransporterAssignedEmail({
  to,
  driverName,
  outboundCode,
  shipToAddress,
  tripUrl,
}) {
  assertMailConfigured();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px">
      <h2 style="color: #111827">Chuyến giao hàng xuất kho</h2>
      <p>Xin chào <strong>${escapeHtml(driverName || 'Tài xế')}</strong>,</p>
      <p>Bạn được gán giao phiếu xuất <strong>${escapeHtml(outboundCode)}</strong>.</p>
      <p>Địa chỉ giao: ${escapeHtml(shipToAddress)}</p>
      <p style="margin: 24px 0">
        <a href="${escapeHtml(tripUrl)}"
           style="display: inline-block; background: #06edf9; color: #0f2223; font-weight: 700;
                  text-decoration: none; padding: 12px 20px; border-radius: 8px">
          Mở chuyến giao
        </a>
      </p>
    </div>
  `;

  const text = [`Chuyến giao ${outboundCode}`, `Địa chỉ: ${shipToAddress}`, tripUrl].join('\n');

  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `Gán giao hàng — ${outboundCode}`,
    text,
    html,
  });
}

/** Tenant admin — WH Admin vừa duyệt yêu cầu thuê kho. */
export async function sendRentalRequestApprovedEmail({
  to,
  tenantAdminName,
  companyName,
  requestCode,
  warehouseName,
  warehouseCode,
  city,
  district,
  contractType,
  reviewedAt,
  rentalRequestsUrl,
}) {
  assertMailConfigured();

  const safeName = escapeHtml(tenantAdminName || 'Tenant Admin');
  const safeCompany = escapeHtml(companyName || '—');
  const safeCode = escapeHtml(requestCode || '—');
  const safeWarehouse = escapeHtml(
    warehouseName ? `${warehouseName}${warehouseCode ? ` (${warehouseCode})` : ''}` : '—'
  );
  const safeRegion = escapeHtml([district, city].filter(Boolean).join(', ') || '—');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px">
      <h2 style="color: #111827">Yêu cầu thuê kho đã được duyệt</h2>
      <p>Xin chào <strong>${safeName}</strong>,</p>
      <p>
        Yêu cầu thuê kho <strong>${safeCode}</strong> của <strong>${safeCompany}</strong> đã được
        Warehouse Admin duyệt. Bạn có thể tiếp tục các bước ký hợp đồng và thanh toán trên hệ thống.
      </p>
      <div style="background: #ecfdf5; border-radius: 8px; padding: 16px; margin: 20px 0">
        <p style="margin: 0 0 8px"><strong>Thông tin duyệt</strong></p>
        <p style="margin: 4px 0">Mã yêu cầu: <code>${safeCode}</code></p>
        <p style="margin: 4px 0">Kho: ${safeWarehouse}</p>
        <p style="margin: 4px 0">Khu vực: ${safeRegion}</p>
        ${contractType ? `<p style="margin: 4px 0">Loại thuê: ${escapeHtml(contractType)}</p>` : ''}
        <p style="margin: 4px 0">Thời điểm duyệt: ${escapeHtml(reviewedAt)}</p>
      </div>
      <p style="margin: 24px 0">
        <a href="${escapeHtml(rentalRequestsUrl)}"
           style="display: inline-block; background: #06edf9; color: #0f2223; font-weight: 700;
                  text-decoration: none; padding: 12px 20px; border-radius: 8px">
          Xem yêu cầu thuê
        </a>
      </p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb" />
      <p style="font-size: 12px; color: #6b7280">NEXSPACE Smart Warehouse — Email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  const text = [
    `Xin chào ${tenantAdminName || 'Tenant Admin'},`,
    '',
    `Yêu cầu thuê ${requestCode} của ${companyName} đã được duyệt.`,
    `Kho: ${warehouseName || '—'}. Khu vực: ${district || ''}, ${city || ''}.`,
    `Thời điểm duyệt: ${reviewedAt}.`,
    '',
    rentalRequestsUrl,
  ].join('\n');

  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `Yêu cầu thuê ${requestCode} đã được duyệt — NEXSPACE Smart Warehouse`,
    text,
    html,
  });
}

/** Tenant admin — yêu cầu thuê kho bị từ chối. */
export async function sendRentalRequestRejectedEmail({
  to,
  tenantAdminName,
  companyName,
  requestCode,
  city,
  district,
  rejectionReason,
  reviewedAt,
  rentalRequestsUrl,
}) {
  assertMailConfigured();

  const safeName = escapeHtml(tenantAdminName || 'Tenant Admin');
  const safeCompany = escapeHtml(companyName || '—');
  const safeCode = escapeHtml(requestCode || '—');
  const safeRegion = escapeHtml([district, city].filter(Boolean).join(', ') || '—');
  const safeReason = escapeHtml(rejectionReason || 'Không có lý do cụ thể');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px">
      <h2 style="color: #111827">Yêu cầu thuê kho bị từ chối</h2>
      <p>Xin chào <strong>${safeName}</strong>,</p>
      <p>
        Yêu cầu thuê kho <strong>${safeCode}</strong> của <strong>${safeCompany}</strong> đã bị từ chối.
      </p>
      <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 20px 0">
        <p style="margin: 0 0 8px"><strong>Chi tiết</strong></p>
        <p style="margin: 4px 0">Mã yêu cầu: <code>${safeCode}</code></p>
        <p style="margin: 4px 0">Khu vực: ${safeRegion}</p>
        <p style="margin: 4px 0">Thời điểm: ${escapeHtml(reviewedAt)}</p>
        <p style="margin: 4px 0">Lý do: ${safeReason}</p>
      </div>
      <p style="margin: 24px 0">
        <a href="${escapeHtml(rentalRequestsUrl)}"
           style="display: inline-block; background: #06edf9; color: #0f2223; font-weight: 700;
                  text-decoration: none; padding: 12px 20px; border-radius: 8px">
          Xem yêu cầu thuê
        </a>
      </p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb" />
      <p style="font-size: 12px; color: #6b7280">NEXSPACE Smart Warehouse — Email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  const text = [
    `Xin chào ${tenantAdminName || 'Tenant Admin'},`,
    '',
    `Yêu cầu thuê ${requestCode} của ${companyName} đã bị từ chối.`,
    `Khu vực: ${district || ''}, ${city || ''}.`,
    `Lý do: ${rejectionReason || 'Không có lý do cụ thể'}.`,
    '',
    rentalRequestsUrl,
  ].join('\n');

  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `Yêu cầu thuê ${requestCode} bị từ chối — NEXSPACE Smart Warehouse`,
    text,
    html,
  });
}

/** Tenant admin — nhắc tiền thuê định kỳ trước 3 ngày đến hạn. */
export async function sendRecurringRentReminderEmail({
  to,
  tenantAdminName,
  contractCode,
  contractName,
  nextBillingDate,
  monthlyRent,
  reminderDays,
  overviewUrl,
}) {
  assertMailConfigured();

  const safeName = escapeHtml(tenantAdminName || 'Tenant Admin');
  const safeCode = escapeHtml(contractCode || '—');
  const safeTitle = escapeHtml(contractName || 'Hợp đồng thuê kho');
  const safeDate = escapeHtml(nextBillingDate || '—');
  const safeAmount = escapeHtml(monthlyRent || '—');
  const safeDays = escapeHtml(String(reminderDays ?? 3));

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px">
      <h2 style="color: #111827">Nhắc thanh toán tiền thuê định kỳ</h2>
      <p>Xin chào <strong>${safeName}</strong>,</p>
      <p>
        Hợp đồng <strong>${safeCode}</strong> sẽ đến kỳ thanh toán tiền thuê định kỳ sau
        <strong>${safeDays} ngày</strong> (ngày <strong>${safeDate}</strong>).
        Vui lòng chuẩn bị thanh toán để tránh quá hạn.
      </p>
      <div style="background: #fffbeb; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #fde68a">
        <p style="margin: 0 0 8px"><strong>Chi tiết</strong></p>
        <p style="margin: 4px 0">Mã HĐ: <code>${safeCode}</code></p>
        <p style="margin: 4px 0">Tên: ${safeTitle}</p>
        <p style="margin: 4px 0">Ngày thanh toán dự kiến: <strong>${safeDate}</strong></p>
        <p style="margin: 4px 0">Tiền thuê tháng: <strong>${safeAmount} ₫</strong></p>
      </div>
      <p style="margin: 24px 0">
        <a href="${escapeHtml(overviewUrl)}"
           style="display: inline-block; background: #06edf9; color: #0f2223; font-weight: 700;
                  text-decoration: none; padding: 12px 20px; border-radius: 8px">
          Xem tiền thuê định kỳ
        </a>
      </p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb" />
      <p style="font-size: 12px; color: #6b7280">NEXSPACE Smart Warehouse — Email tự động, vui lòng không trả lời.</p>
    </div>
  `;

  const text = [
    `Xin chào ${tenantAdminName || 'Tenant Admin'},`,
    '',
    `HĐ ${contractCode} sẽ đến kỳ thanh toán tiền thuê định kỳ sau ${reminderDays ?? 3} ngày (${nextBillingDate}).`,
    `Tiền thuê tháng: ${monthlyRent} ₫`,
    '',
    overviewUrl,
  ].join('\n');

  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: `Nhắc tiền thuê định kỳ — HĐ ${contractCode} — NEXSPACE Smart Warehouse`,
    text,
    html,
  });
}

export default transporter;
