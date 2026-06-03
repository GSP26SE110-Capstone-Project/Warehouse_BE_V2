import AppError from '../utils/AppError.js';

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      throw new AppError('Vui lòng đăng nhập để tiếp tục.', 401, 'UNAUTHORIZED');
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError('Bạn không có quyền thực hiện thao tác này.', 403, 'FORBIDDEN');
    }
    next();
  };
}
