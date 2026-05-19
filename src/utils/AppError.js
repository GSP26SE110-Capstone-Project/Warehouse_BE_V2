export default class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', errors = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = true;
  }
}
