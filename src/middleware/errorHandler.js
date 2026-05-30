import AppError from '../utils/AppError.js';
import { toVietnameseErrorMessage } from '../utils/errorMessages.vi.js';

function formatDuplicateMessage(err) {
  const detail = String(err?.detail ?? '');
  const constraint = String(err?.constraint ?? '');
  const match = detail.match(/Key \(([^)]+)\)=\(([^)]*)\) already exists/i);
  const field = match?.[1];
  const value = match?.[2];

  if (constraint === 'tenant_companies_tax_code_key' || field === 'tax_code') {
    return `Mã số thuế "${value ?? ''}" đã tồn tại. Vui lòng dùng mã số thuế khác.`;
  }
  if (constraint === 'tenant_companies_contact_email_key' || field === 'contact_email') {
    return `Email liên hệ "${value ?? ''}" đã tồn tại.`;
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
    case '22P02':
      return new AppError('Định dạng mã định danh không hợp lệ', 400, 'INVALID_ID');
    default:
      return null;
  }
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
    } else {
      error = new AppError(
        process.env.NODE_ENV === 'production' ? 'Lỗi máy chủ nội bộ' : err.message,
        500,
        'INTERNAL_ERROR'
      );
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
