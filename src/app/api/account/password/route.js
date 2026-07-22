import { prisma } from "@/lib/db";
import { getCurrentUser, verifyPassword, hashPassword } from "@/lib/auth";

// POST /api/account/password — any signed-in user changes their own password.
export async function POST(req) {
  const claims = await getCurrentUser();
  if (!claims) return Response.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const current = String(body.currentPassword || "");
  const next = String(body.newPassword || "");

  if (next.length < 8)
    return Response.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  if (next === current)
    return Response.json({ error: "New password must be different from the current one." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user) return Response.json({ error: "Account not found." }, { status: 404 });

  const ok = await verifyPassword(current, user.passwordHash);
  if (!ok) return Response.json({ error: "Your current password is incorrect." }, { status: 400 });

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), passwordChangedAt: new Date() },
  });
  return Response.json({ ok: true });
}
