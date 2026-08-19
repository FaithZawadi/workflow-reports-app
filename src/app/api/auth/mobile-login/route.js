import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { claimsFromUser } from "@/lib/auth";
import { assignedClientsFor } from "@/lib/assignments";
import { signSession, mobileMaxAgeSeconds, MOBILE_TTL_DAYS } from "@/lib/jwt";
import { hit, reset, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// POST /api/auth/mobile-login — token login for the Flutter app. Verifies the
// credentials and returns a signed JWT (no cookie). The app stores it securely
// and sends it as `Authorization: Bearer <token>` on subsequent requests.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) return Response.json({ error: "Enter your email and password." }, { status: 400 });

  // Throttle brute-force: 20 tries / 15 min per IP, 5 per account.
  const ip = clientIp(req);
  const ipGate = hit(`mlogin:ip:${ip}`, { limit: 20 });
  const acctGate = hit(`mlogin:acct:${email}`, { limit: 5 });
  if (!ipGate.ok || !acctGate.ok) {
    return Response.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(ipGate.retryAfter || acctGate.retryAfter || 900) } }
    );
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { client: true } });
  if (!user || !user.active) return Response.json({ error: "Wrong email or password." }, { status: 401 });
  if (!(await verifyPassword(password, user.passwordHash)))
    return Response.json({ error: "Wrong email or password." }, { status: 401 });

  reset(`mlogin:acct:${email}`);

  // Long-lived token so the field app stays signed in (stored encrypted on-device).
  const token = await signSession(claimsFromUser(user), { expiresIn: `${MOBILE_TTL_DAYS}d` });
  const { assignedClients, primaryName } = await assignedClientsFor(user.id);
  return Response.json({
    token,
    expiresInSeconds: mobileMaxAgeSeconds,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      roles: user.roles && user.roles.length ? user.roles : [user.role],
      clientId: user.clientId,
      clientName: primaryName || user.client?.name || null,
      assignedClients,
      site: user.site || null,
    },
  });
}
