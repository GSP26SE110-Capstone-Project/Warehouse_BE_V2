export function success(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function created(res, data, message = 'Created successfully') {
  return success(res, data, message, 201);
}

export function paginated(res, data, meta, message = 'Success') {
  return res.status(200).json({
    success: true,
    message,
    data,
    meta,
  });
}

export function fail(res, message, statusCode = 500, code = 'INTERNAL_ERROR', errors = null) {
  const body = {
    success: false,
    message,
    code,
  };
  if (errors != null) {
    body.errors = errors;
  }
  return res.status(statusCode).json(body);
}
