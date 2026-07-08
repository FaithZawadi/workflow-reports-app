import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SESSION_COOKIE, signSession, verifySession, sessionMaxAgeSeconds } from "./jwt";

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Build the claims we keep in the session token.
export function claimsFromUser(user) {
  return {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clientId: user.clientId || null,
    site: user.site || null,
  };
}

// Whether to mark the session cookie `Secure`. On by default in production
// (required so cookies survive over the public internet / HTTPS). Set
// COOKIE_SECURE=false to allow login over plain HTTP on a TRUSTED local network
// — e.g. an on-site server reached by LAN IP without TLS. Never do this on a
// publicly reachable host.
function cookieSecure() {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export async function startSession(user) {
  const token = await signSession(claimsFromUser(user));
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });
}

export function endSession() {
  cookies().set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

// Returns the session claims for the current request, or null.
export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySession(token);
  if (!claims) return null;
  return claims;
}

// Guard for route handlers. Returns claims or throws a Response.
export async function requireUser(roles) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Not signed in" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  if (roles && roles.length && !roles.includes(user.role)) {
    throw new Response(JSON.stringify({ error: "Not allowed" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  return user;
}
