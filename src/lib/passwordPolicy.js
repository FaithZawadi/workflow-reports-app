// Password rotation policy: registered users are prompted to change their
// password every 60 days (~2 months). The clock resets whenever the password is
// changed (self-service) or reset by an admin.

export const PASSWORD_MAX_AGE_DAYS = 60;
const MS = PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

// Is this user's password due for a change? (No timestamp = treat as due.)
export function isPasswordDue(passwordChangedAt) {
  if (!passwordChangedAt) return true;
  const t = new Date(passwordChangedAt).getTime();
  if (isNaN(t)) return true;
  return Date.now() - t >= MS;
}

// Whole days until the next prompt (0 if already due).
export function daysUntilDue(passwordChangedAt) {
  if (!passwordChangedAt) return 0;
  const t = new Date(passwordChangedAt).getTime();
  if (isNaN(t)) return 0;
  const left = t + MS - Date.now();
  return left <= 0 ? 0 : Math.ceil(left / (24 * 60 * 60 * 1000));
}
