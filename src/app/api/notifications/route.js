import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/notifications — the current user's recent notifications + unread count.
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const [list, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.sub }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId: user.sub, read: false } }),
  ]);
  return Response.json({ notifications: list, unread });
}

// POST /api/notifications — mark notifications read.
//   { markAll: true }  -> all of the user's notifications
//   { ids: [...] }      -> the listed ones (that belong to the user)
export async function POST(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const b = await req.json().catch(() => ({}));
  if (b.markAll) {
    await prisma.notification.updateMany({ where: { userId: user.sub, read: false }, data: { read: true } });
  } else if (Array.isArray(b.ids) && b.ids.length) {
    await prisma.notification.updateMany({ where: { userId: user.sub, id: { in: b.ids.map(String) } }, data: { read: true } });
  }
  const unread = await prisma.notification.count({ where: { userId: user.sub, read: false } });
  return Response.json({ ok: true, unread });
}
