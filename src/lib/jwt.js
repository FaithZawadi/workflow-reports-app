import { SignJWT, jwtVerify } from "jose";

const secretString = process.env.AUTH_SECRET || "insecure-dev-secret-change-me";
const secret = new TextEncoder().encode(secretString);
const ttlHours = Number(process.env.SESSION_TTL_HOURS || 12);

export const SESSION_COOKIE = "qsl_session";

export async function signSession(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlHours}h`)
    .sign(secret);
}

export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export const sessionMaxAgeSeconds = ttlHours * 60 * 60;
