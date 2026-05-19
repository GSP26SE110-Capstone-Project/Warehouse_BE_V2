/** Strip sensitive fields before sending user in API responses. */
export function toPublicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}
