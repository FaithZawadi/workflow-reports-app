import { SignJWT, jwtVerify } from "jose";

const secretString = process.env.AUTH_SECRET || "insecure-dev-secret-change-me";
const secret = new TextEncoder().encode(secretString);
const ttlHours = Number(process.env.SESSION_TTL_HOURS || 12);

export const SESSION_COOKIE = "qsl_session";

export async function signSession(payload, { expiresIn } = {}) {
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
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export const sessionMaxAgeSeconds = ttlHours * 60 * 60;
