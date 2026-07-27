import { SignJWT, jwtVerify } from "jose";

const DEV_FALLBACK = "insecure-dev-secret-change-me";
const secretString = process.env.AUTH_SECRET || DEV_FALLBACK;
const secret = new TextEncoder().encode(secretString);
const ttlHours = Number(process.env.SESSION_TTL_HOURS || 12);

export const SESSION_COOKIE = "qsl_session";

// Refuse to sign/verify with a weak secret in production: without a strong,
// unique AUTH_SECRET every token would be forgeable. Checked lazily (at request
// time, not build time) so `next build` — which runs before the runtime env is
// present — is unaffected. Set AUTH_SECRET to 32+ random bytes on the server.
function assertStrongSecret() {
  if (process.env.NODE_ENV !== "production") return;
  const s = process.env.AUTH_SECRET || "";
  if (!s || s === DEV_FALLBACK || s.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too weak. Set a random 32+ character AUTH_SECRET " +
        "in the server environment before running in production."
    );
  }
}

export async function signSession(payload, { expiresIn } = {}) {
  assertStrongSecret();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn || `${ttlHours}h`)
    .sign(secret);
}

// The mobile app keeps the user signed in for a long time (a field worker
// shouldn't have to log in daily). The token is stored encrypted on-device and
// re-issued on every login. Override with MOBILE_SESSION_TTL_DAYS.
export const MOBILE_TTL_DAYS = Number(process.env.MOBILE_SESSION_TTL_DAYS || 365);
export const mobileMaxAgeSeconds = MOBILE_TTL_DAYS * 24 * 60 * 60;

export async function verifySession(token) {
  assertStrongSecret();
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export const sessionMaxAgeSeconds = ttlHours * 60 * 60;
