export function normalizeLocation(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

export function locationMatches(a, b) {
  const left = normalizeLocation(a);
  const right = normalizeLocation(b);
  if (!left || !right) return false;
  return left === right;
}

export function requireLocationField(value, fieldName) {
  const trimmed = value == null ? '' : String(value).trim();
  if (!trimmed) {
    return { error: `${fieldName} is required` };
  }
  return { value: trimmed };
}
