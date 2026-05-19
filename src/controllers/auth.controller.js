import * as authService from '../services/auth.service.js';
import { success } from '../utils/apiResponse.js';

export async function login(req, res) {
  const result = await authService.login(req.body);
  success(res, result, 'Login successful');
}
