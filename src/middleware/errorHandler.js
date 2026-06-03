import AppError from '../utils/AppError.js';
import { toVietnameseErrorMessage } from '../utils/errorMessages.vi.js';

function formatDuplicateMessage(err) {
  const detail = String(err?.detail ?? '');
  const constraint = String(err?.constraint ?? '');
  const match = detail.match(/Key \(([^)]+)\)=\(([^)]*)\) already exists/i);
  const field = match?.[1];
  const value = match?.[2];

  if (constraint === 'tenant_companies_tax_code_key' || field === 'tax_code') {
    return `Mã số thuế "${value ?? ''}" đã được đăng ký. Dùng email liên hệ đã đăng ký trước đó, hoặc tra cứu yêu cầu bằng mã RR + email.`;
  }
  if (constraint === 'tenant_companies_contact_email_key' || field === 'contact_email') {
    return `Email liên hệ "${value ?? ''}" đã được dùng đăng ký trước đó. Nếu bạn đã gửi yêu cầu, tra cứu bằng mã RR + email ở form bên cạnh — hoặc gửi lại form với đúng email này để tạo yêu cầu mới.`;
  }
  if (constraint === 'tenant_companies_company_code_key' || field === 'company_code') {
    return `Mã công ty "${value ?? ''}" đã tồn tại.`;
  }
  if (field && value != null) {
    return `Giá trị "${value}" của trường "${field}" đã tồn tại.`;
  }
  return 'Dữ liệu đã tồn tại (trùng khóa duy nhất).';
}

function mapPgError(err) {
  switch (err.code) {
    case '23505':
      return new AppError(formatDuplicateMessage(err), 409, 'DUPLICATE');
    case '23503':
      return new AppError('Dữ liệu liên quan không tồn tại hoặc tham chiếu không hợp lệ', 400, 'FK_VIOLATION');
    case '22P02': {
      const pgMsg = String(err?.message ?? '');
      if (/enum/i.test(pgMsg)) {
        return new AppError(
          'Cơ sở dữ liệu chưa cập nhật enum (ví dụ PENDING_PAYMENT). Chạy: npm run db:migrate:all hoặc migration contract_billing_termination.sql',
          400,
          'SCHEMA_OUTDATED'
        );
      }
      return new AppError('Định dạng mã định danh không hợp lệ', 400, 'INVALID_ID');
    }
    default:
      return null;
  }
}

function isDbConnectionError(err) {
  if (!err) return false;
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
    return true;
  }
  if (err.name === 'AggregateError' && Array.isArray(err.errors)) {
    return err.errors.some((e) => isDbConnectionError(e));
  }
  return false;
}

function resolveUnknownErrorMessage(err) {
  if (isDbConnectionError(err)) {
    return 'Không kết nối được cơ sở dữ liệu. Vui lòng bật PostgreSQL/Docker rồi thử lại.';
  }
  if (err?.message?.trim()) {
    return err.message;
  }
  if (err?.name === 'AggregateError' && Array.isArray(err.errors)) {
    const nested = err.errors.find((e) => e?.message?.trim());
    if (nested?.message) return nested.message;
  }
  return process.env.NODE_ENV === 'production' ? 'Lỗi máy chủ nội bộ' : 'Lỗi máy chủ nội bộ';
}

export default function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let error = err;

  if (!(error instanceof AppError)) {
    const pgError = mapPgError(error);
    if (pgError) {
      error = pgError;
    } else if (isDbConnectionError(error)) {
      error = new AppError(resolveUnknownErrorMessage(error), 503, 'DB_UNAVAILABLE');
    } else {
      error = new AppError(resolveUnknownErrorMessage(error), 500, 'INTERNAL_ERROR');
    }
  }

  if (process.env.NODE_ENV !== 'production' && !(err instanceof AppError)) {
    console.error(err);
  }

  const body = {
    success: false,
    message: toVietnameseErrorMessage(error.message),
    code: error.code,
  };

  if (error.errors != null) {
    body.errors = error.errors;
  }

  res.status(error.statusCode).json(body);
}
