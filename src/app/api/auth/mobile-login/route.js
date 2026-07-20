import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { claimsFromUser } from "@/lib/auth";
import { signSession, sessionMaxAgeSeconds } from "@/lib/jwt";

export const dynamic = "force-dynamic";

// POST /api/auth/mobile-login — token login for the Flutter app. Verifies the
// credentials and returns a signed JWT (no cookie). The app stores it securely
// and sends it as `Authorization: Bearer <token>` on subsequent requests.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) return Response.json({ error: "Enter your email and password." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email }, include: { client: true } });
  if (!user || !user.active) return Response.json({ error: "Wrong email or password." }, { status: 401 });
  if (!(await verifyPassword(password, user.passwordHash)))
    return Response.json({ error: "Wrong email or password." }, { status: 401 });

  const token = await signSession(claimsFromUser(user));
  return Response.json({
    token,
    expiresInSeconds: sessionMaxAgeSeconds,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      roles: user.roles && user.roles.length ? user.roles : [user.role],
      clientId: user.clientId,
      clientName: user.client?.name || null,
    },
  });
}
