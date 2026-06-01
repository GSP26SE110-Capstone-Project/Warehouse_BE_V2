import * as tenantService from '../services/tenantCompany.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { status } = req.query;

  const result = await tenantService.listTenantCompanies({
    status,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const tenant = await tenantService.getTenantCompany(req.params.tenantId);
  success(res, tenant);
}

export async function create(req, res) {
  const tenant = await tenantService.resolveOrCreateGuestTenant(req.body);
  const message = tenant.reusedExistingProfile
    ? 'Hồ sơ công ty với email này đã có — tiếp tục tạo yêu cầu thuê mới.'
    : 'Created successfully';
  created(res, tenant, message);
}

export async function update(req, res) {
  const tenant = await tenantService.updateTenantCompany(req.params.tenantId, req.body);
  success(res, tenant, 'Updated successfully');
}

export async function remove(req, res) {
  const tenant = await tenantService.deleteTenantCompany(req.params.tenantId);
  success(res, tenant, 'Deleted successfully');
}
