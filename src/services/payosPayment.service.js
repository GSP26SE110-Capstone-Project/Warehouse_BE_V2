import { APIError } from '@payos/node';
import Payment from '../models/Payment.js';
import AppError from '../utils/AppError.js';
import { parseUuid } from '../utils/validate.js';
import {
  getPayOSClient,
  getPayOSFrontendOrigin,
  isPayOSConfigured,
  resolvePayOSCheckoutAmount,
} from '../config/payos.js';
import { getContract } from './contract.service.js';
import Invoice from '../models/Invoice.js';
import { markInvoicePaid } from './contractInvoice.service.js';

const MAX_PAYOS_DESCRIPTION_LEN = 25;
const PAYOS_CHECKOUT_BASE = 'https://pay.payos.vn/web';
const PAYOS_TERMINAL_STATUSES = new Set(['PAID', 'CANCELLED', 'EXPIRED']);

function buildCheckoutUrl(paymentLinkId) {
  const id = String(paymentLinkId ?? '').trim();
  return id ? `${PAYOS_CHECKOUT_BASE}/${id}` : null;
}

function isPayOSOrderAlreadyExistsError(err) {
  if (!(err instanceof APIError)) return false;
  if (String(err.code ?? '') === '231') return true;
  const msg = String(err.desc ?? err.message ?? '').toLowerCase();
  return msg.includes('đã tồn tại') || msg.includes('already exists');
}

async function getPayOSLinkInfo(orderCode) {
  const payos = getPayOSClient();
  return payos.paymentRequests.get(Number(orderCode));
}

async function fetchPayOSCheckoutByOrderCode(orderCode) {
  const info = await getPayOSLinkInfo(orderCode);
  const paymentLinkId = info?.id ?? info?.paymentLinkId;
  const checkoutUrl = buildCheckoutUrl(paymentLinkId);
  if (!checkoutUrl) {
    throw new AppError('PayOS không trả payment link id', 502, 'PAYOS_INVALID_RESPONSE');
  }
  if (PAYOS_TERMINAL_STATUSES.has(info?.status)) {
    const err = new AppError(
      `Link thanh toán PayOS đã ở trạng thái ${info.status}.`,
      400,
      'PAYOS_LINK_NOT_PAYABLE'
    );
    err.payosStatus = info?.status;
    throw err;
  }
  return { paymentLinkId, checkoutUrl, status: info?.status };
}

async function retirePendingPayOSPayment(paymentRow, orderCode) {
  if (!paymentRow?.paymentId) return;
  try {
    const payos = getPayOSClient();
    await payos.paymentRequests.cancel(
      Number(orderCode),
      'Tenant hủy hoặc tạo link thanh toán mới'
    );
  } catch {
    // Đơn có thể đã hủy trên PayOS — vẫn đánh dấu FAILED trong DB
  }
  await Payment.updateById(paymentRow.paymentId, {
    paymentStatus: 'FAILED',
  });
}

/** Bỏ payment PENDING nếu link PayOS đã CANCELLED/EXPIRED — cho phép tạo order mới. PAID → hoàn tất thanh toán. */
async function refreshPendingPaymentAfterPayOSTerminal(pending) {
  if (!pending?.payosOrderCode) {
    return { paymentRow: null, orderCode: null };
  }

  const orderCode = Number(pending.payosOrderCode);
  try {
    const info = await getPayOSLinkInfo(orderCode);
    if (info?.status === 'PAID') {
      await completePaymentByPayOSOrderCode(orderCode);
      const paymentRow = await Payment.findById(pending.paymentId);
      return { paymentRow, orderCode, payosCompleted: true };
    }
    if (!PAYOS_TERMINAL_STATUSES.has(info?.status)) {
      return { paymentRow: pending, orderCode };
    }
  } catch {
    // PayOS không còn đơn / lỗi tra cứu — tạo order mới
  }

  await retirePendingPayOSPayment(pending, orderCode);
  return { paymentRow: null, orderCode: null };
}

async function persistPayOSLinkOnPayment(paymentRow, { paymentLinkId }) {
  if (!paymentRow?.paymentId || !paymentLinkId) return paymentRow;
  return Payment.updateById(paymentRow.paymentId, {
    payosPaymentLinkId: paymentLinkId,
    transactionCode: paymentLinkId,
  });
}

async function createNewPendingPaymentRow(invoiceId, payosAmount) {
  const orderCode = await allocatePayOSOrderCode();
  const paymentRow = await Payment.create({
    invoiceId,
    amount: payosAmount,
    paymentMethod: 'E_WALLET',
    paymentStatus: 'PENDING',
    payosOrderCode: orderCode,
  });
  return { orderCode, paymentRow };
}

/** Tạo link PayOS; nếu orderCode cũ đã hủy/hết hạn thì tự tạo order mới (tối đa 2 lần). */
async function createPayOSPaymentLinkAttempt({
  orderCode,
  payosAmount,
  description,
  returnUrl,
  cancelUrl,
}) {
  const payos = getPayOSClient();
  try {
    return await payos.paymentRequests.create({
      orderCode,
      amount: payosAmount,
      description,
      returnUrl,
      cancelUrl,
    });
  } catch (err) {
    if (!isPayOSOrderAlreadyExistsError(err)) {
      throw err;
    }
    const info = await getPayOSLinkInfo(orderCode);
    if (PAYOS_TERMINAL_STATUSES.has(info?.status)) {
      const terminal = new AppError(
        `Link PayOS đã ${info.status} — cần order mới`,
        400,
        'PAYOS_LINK_NOT_PAYABLE'
      );
      terminal.payosStatus = info?.status;
      throw terminal;
    }
    return fetchPayOSCheckoutByOrderCode(orderCode).then((existing) => ({
      checkoutUrl: existing.checkoutUrl,
      paymentLinkId: existing.paymentLinkId,
    }));
  }
}

function truncatePayOSDescription(text) {
  const s = String(text ?? '').trim() || 'Thanh toan';
  return s.length <= MAX_PAYOS_DESCRIPTION_LEN
    ? s
    : s.slice(0, MAX_PAYOS_DESCRIPTION_LEN);
}

async function allocatePayOSOrderCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = Date.now() + attempt;
    const existing = await Payment.findOne({ payosOrderCode: code });
    if (!existing) return code;
  }
  throw new AppError('Không tạo được mã đơn PayOS', 500, 'PAYOS_ORDER_CODE');
}

export async function createInvoicePayOSPaymentLink(
  contractId,
  invoiceId,
  { returnUrl, cancelUrl } = {}
) {
  if (!isPayOSConfigured()) {
    throw new AppError('PayOS chưa cấu hình trên server', 503, 'PAYOS_NOT_CONFIGURED');
  }

  const cId = parseUuid(contractId, 'contractId');
  const iId = parseUuid(invoiceId, 'invoiceId');
  const contract = await getContract(cId);
  const invoice = await Invoice.findById(iId);

  if (!invoice || invoice.contractId !== cId) {
    throw new AppError('Invoice not found for this contract', 404, 'NOT_FOUND');
  }
  if (invoice.paymentStatus === 'PAID') {
    await markInvoicePaid(cId, iId);
    throw new AppError('Invoice đã thanh toán', 400, 'INVOICE_ALREADY_PAID');
  }

  const { payosAmount, invoiceAmount, devMode } = resolvePayOSCheckoutAmount(
    invoice.totalAmount
  );
  if (payosAmount < 1000) {
    throw new AppError('Số tiền thanh toán PayOS tối thiểu 1.000đ', 400, 'VALIDATION_ERROR');
  }

  const origin = getPayOSFrontendOrigin();
  const finalReturnUrl =
    returnUrl ||
    `${origin}/staff/contracts/payment/return?contractId=${cId}&invoiceId=${iId}`;
  const finalCancelUrl =
    cancelUrl ||
    `${origin}/staff/contracts/payment/cancel?contractId=${cId}&invoiceId=${iId}`;
  const clientProvidedUrls = Boolean(returnUrl || cancelUrl);

  if (clientProvidedUrls) {
    console.log('[PAYOS] Checkout URLs from client:', {
      returnUrl: finalReturnUrl,
      cancelUrl: finalCancelUrl,
    });
  }

  const pending = await Payment.findOne({
    invoiceId: iId,
    paymentStatus: 'PENDING',
  });

  const refreshed = await refreshPendingPaymentAfterPayOSTerminal(pending);
  let orderCode = refreshed.orderCode;
  let paymentRow = refreshed.paymentRow;

  if (!orderCode) {
    ({ orderCode, paymentRow } = await createNewPendingPaymentRow(iId, payosAmount));
  } else if (Math.round(Number(paymentRow.amount) || 0) !== payosAmount) {
    await retirePendingPayOSPayment(paymentRow, orderCode);
    ({ orderCode, paymentRow } = await createNewPendingPaymentRow(iId, payosAmount));
  } else if (clientProvidedUrls && paymentRow && orderCode) {
    // Link PayOS cũ gắn return URL lúc tạo — hủy và tạo order mới khi FE gửi URL mới
    await retirePendingPayOSPayment(paymentRow, orderCode);
    ({ orderCode, paymentRow } = await createNewPendingPaymentRow(iId, payosAmount));
  }

  const returnPayload = (checkoutUrl, paymentLinkId, reusedExistingLink) => ({
    orderCode,
    amount: payosAmount,
    invoiceAmount,
    devMode,
    checkoutUrl,
    paymentLinkId,
    returnUrl: finalReturnUrl,
    cancelUrl: finalCancelUrl,
    invoiceId: iId,
    contractId: cId,
    reusedExistingLink: Boolean(reusedExistingLink),
  });

  const description = truncatePayOSDescription(
    invoice.invoiceCode || contract.contractCode || 'HĐ thuê kho'
  );

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!clientProvidedUrls) {
      try {
        const existing = await fetchPayOSCheckoutByOrderCode(orderCode);
        paymentRow = await persistPayOSLinkOnPayment(paymentRow, existing);
        return returnPayload(existing.checkoutUrl, existing.paymentLinkId, true);
      } catch (err) {
        if (err instanceof AppError && err.code === 'PAYOS_LINK_NOT_PAYABLE' && attempt === 0) {
          await retirePendingPayOSPayment(paymentRow, orderCode);
          ({ orderCode, paymentRow } = await createNewPendingPaymentRow(iId, payosAmount));
          continue;
        }
        if (err instanceof AppError && err.code === 'PAYOS_LINK_NOT_PAYABLE') {
          throw err;
        }
        // Chưa có link hợp lệ trên PayOS — tạo bên dưới
      }
    }

    try {
      const paymentLink = await createPayOSPaymentLinkAttempt({
        orderCode,
        payosAmount,
        description,
        returnUrl: finalReturnUrl,
        cancelUrl: finalCancelUrl,
      });
      paymentRow = await persistPayOSLinkOnPayment(paymentRow, paymentLink);
      return returnPayload(
        paymentLink.checkoutUrl,
        paymentLink.paymentLinkId,
        attempt > 0
      );
    } catch (err) {
      if (err instanceof AppError && err.code === 'PAYOS_LINK_NOT_PAYABLE' && attempt === 0) {
        await retirePendingPayOSPayment(paymentRow, orderCode);
        ({ orderCode, paymentRow } = await createNewPendingPaymentRow(iId, payosAmount));
        continue;
      }
      throw err;
    }
  }

  throw new AppError(
    'Không tạo được link PayOS — thử lại sau hoặc liên hệ kho',
    502,
    'PAYOS_CREATE_FAILED'
  );
}

export async function completePaymentByPayOSOrderCode(orderCode) {
  const code = Number(orderCode);
  if (!Number.isFinite(code)) {
    throw new AppError('orderCode PayOS không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const payment = await Payment.findOne({ payosOrderCode: code });
  if (!payment) {
    throw new AppError('Không tìm thấy payment theo orderCode PayOS', 404, 'NOT_FOUND');
  }
  if (payment.paymentStatus === 'SUCCESS') {
    const invoice = await Invoice.findById(payment.invoiceId);
    return { payment, invoice, contract: invoice ? await getContract(invoice.contractId) : null };
  }

  await Payment.updateById(payment.paymentId, {
    paymentStatus: 'SUCCESS',
    paidAt: new Date(),
  });

  const invoice = await Invoice.findById(payment.invoiceId);
  if (!invoice) {
    throw new AppError('Invoice linked to payment not found', 404, 'NOT_FOUND');
  }

  const result = await markInvoicePaid(invoice.contractId, invoice.invoiceId);
  return { payment, ...result };
}

/**
 * Đồng bộ trạng thái từ PayOS (trang return / webhook trễ).
 * Nếu PayOS báo PAID → mark invoice + ACTIVE như webhook.
 */
export async function syncInvoicePaymentFromPayOS(contractId, invoiceId) {
  if (!isPayOSConfigured()) {
    throw new AppError('PayOS chưa cấu hình trên server', 503, 'PAYOS_NOT_CONFIGURED');
  }

  const cId = parseUuid(contractId, 'contractId');
  const iId = parseUuid(invoiceId, 'invoiceId');
  await getContract(cId);
  const invoice = await Invoice.findById(iId);

  if (!invoice || invoice.contractId !== cId) {
    throw new AppError('Invoice not found for this contract', 404, 'NOT_FOUND');
  }
  if (invoice.paymentStatus === 'PAID') {
    const contract = await getContract(cId);
    const recovered = await markInvoicePaid(cId, iId);
    return {
      synced: true,
      alreadyPaid: true,
      recoveredContract: recovered.contract.status !== contract.status,
      ...recovered,
    };
  }

  const payments = await Payment.findAll({ invoiceId: iId }, { orderBy: 'created_at DESC', limit: 5 });
  const payment =
    payments.find((p) => p.paymentStatus === 'PENDING' && p.payosOrderCode) ??
    payments.find((p) => p.payosOrderCode);

  if (!payment?.payosOrderCode) {
    throw new AppError(
      'Không tìm thấy đơn PayOS cho invoice này — tạo link thanh toán trước',
      404,
      'NOT_FOUND'
    );
  }

  const orderCode = Number(payment.payosOrderCode);
  const info = await getPayOSLinkInfo(orderCode);

  if (info?.status === 'PAID') {
    const result = await completePaymentByPayOSOrderCode(orderCode);
    return { synced: true, payosStatus: 'PAID', orderCode, ...result };
  }

  return {
    synced: false,
    payosStatus: info?.status ?? 'UNKNOWN',
    orderCode,
    message:
      info?.status === 'PENDING'
        ? 'PayOS chưa ghi nhận thanh toán — chờ vài giây hoặc kiểm tra webhook'
        : `PayOS: trạng thái ${info?.status ?? 'UNKNOWN'}`,
  };
}

export async function handlePayOSWebhook(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new AppError('Webhook body không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const payos = getPayOSClient();
  let webhookData;
  try {
    webhookData = await payos.webhooks.verify(payload);
  } catch (err) {
    const hint =
      'Kiểm tra PAYOS_CHECKSUM_KEY (Checksum Key trên kênh thanh toán, không phải API Key).';
    throw new AppError(
      `${err?.message ?? 'Xác thực chữ ký webhook thất bại'}. ${hint}`,
      400,
      'PAYOS_WEBHOOK_INVALID'
    );
  }

  if (!payload.success || payload.code !== '00') {
    return {
      handled: false,
      reason: payload.desc ?? 'payment_not_success',
      orderCode: webhookData?.orderCode,
    };
  }

  const orderCode = webhookData?.orderCode;
  if (orderCode == null) {
    return { handled: false, reason: 'missing_order_code' };
  }

  try {
    const result = await completePaymentByPayOSOrderCode(orderCode);
    return { handled: true, orderCode, ...result };
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 404) {
      return {
        handled: false,
        reason: 'order_not_in_db',
        orderCode,
        message:
          'Webhook hợp lệ — orderCode chưa có trong DB (có thể là giao dịch test PayOS)',
      };
    }
    throw err;
  }
}
