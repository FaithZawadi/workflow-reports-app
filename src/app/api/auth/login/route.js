import { prisma } from "@/lib/db";
import { verifyPassword, startSession } from "@/lib/auth";
import { hit, reset, clientIp } from "@/lib/rateLimit";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return Response.json({ error: "Enter your email and password." }, { status: 400 });
  }

  // Throttle brute-force: 20 tries / 15 min per IP, 5 per account.
  const ip = clientIp(req);
  const ipGate = hit(`login:ip:${ip}`, { limit: 20 });
  const acctGate = hit(`login:acct:${email}`, { limit: 5 });
  if (!ipGate.ok || !acctGate.ok) {
    return Response.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(ipGate.retryAfter || acctGate.retryAfter || 900) } }
    );
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { client: true } });
  if (!user || !user.active) {
    return Response.json({ error: "Wrong email or password." }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return Response.json({ error: "Wrong email or password." }, { status: 401 });
  }

  // Successful login — clear this account's counter.
  reset(`login:acct:${email}`);

  // Every role signs in with just email + password. (The former oversight
  // access-code gate was removed — access is governed by the user's roles.)
  await startSession(user);

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      roles: user.roles && user.roles.length ? user.roles : [user.role],
      clientId: user.clientId,
      clientName: user.client?.name || null,
      site: user.site,
    },
  });
}
