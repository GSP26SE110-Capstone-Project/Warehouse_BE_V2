import * as userService from '../services/user.service.js';
import { paginated, success } from '../utils/apiResponse.js';
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
  const { user, welcomeEmailPromise } = await userService.createUser(req.user, req.body);

  res.status(201).json({ message: 'Create user successfully', data: user });

  if (welcomeEmailPromise) {
    welcomeEmailPromise
      .then(() => {
        console.log(`[USER] Welcome email sent to ${user.email}`);
      })
      .catch((err) => {
        console.error(`[USER] Welcome email failed for ${user.email}:`, err);
      });
  }
}

export async function update(req, res) {
  const user = await userService.updateUser(req.user, req.params.userId, req.body);
  success(res, user, 'Updated successfully');
}
