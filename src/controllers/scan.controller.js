import * as scanResolveService from '../services/scanResolve.service.js';
import { success } from '../utils/apiResponse.js';

export async function resolve(req, res) {
  const value = req.query.value ?? req.body?.value;
  const result = await scanResolveService.resolveBarcodeScan(value, req.user, {
    warehouseId: req.query.warehouseId ?? req.body?.warehouseId,
  });
  success(res, result);
}
