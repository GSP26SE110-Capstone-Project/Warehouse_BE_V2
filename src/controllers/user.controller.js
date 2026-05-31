import * as userService from '../services/user.service.js';
import { created, paginated, success } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/validate.js';

export async function me(req, res) {
  success(res, req.user);
}

export async function updateMe(req, res) {
  const user = await userService.updateSelfProfile(req.user, req.body);
  success(res, user, 'Updated successfully');
}

export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { role, status } = req.query;

  const result = await userService.listUsers(req.user, {
    role,
    status,
    page,
    limit,
    offset,
  });

  paginated(res, result.items, result.meta);
}

export async function getById(req, res) {
  const user = await userService.getUserById(req.user, req.params.userId);
  success(res, user);
}

export async function create(req, res) {
  const result = await userService.createUser(req.user, req.body);
  const message =
    result.welcomeEmail?.sent === true
      ? `Created successfully. Welcome email sent to ${result.welcomeEmail.to}.`
      : result.welcomeEmail?.sent === false
        ? `Created successfully but welcome email failed: ${result.welcomeEmail.error}`
        : 'Created successfully';
  created(res, result, message);
}

export async function update(req, res) {
  const user = await userService.updateUser(req.user, req.params.userId, req.body);
  success(res, user, 'Updated successfully');
}
