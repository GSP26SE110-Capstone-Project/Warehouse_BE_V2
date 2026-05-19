import AppError from '../utils/AppError.js';

function mapPgError(err) {
  switch (err.code) {
    case '23505':
      return new AppError('Resource already exists', 409, 'DUPLICATE');
    case '23503':
      return new AppError('Related resource not found or invalid reference', 400, 'FK_VIOLATION');
    case '22P02':
      return new AppError('Invalid identifier format', 400, 'INVALID_ID');
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
        process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
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
    message: error.message,
    code: error.code,
  };

  if (error.errors != null) {
    body.errors = error.errors;
  }

  res.status(error.statusCode).json(body);
}
