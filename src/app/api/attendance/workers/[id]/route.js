import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageAttendance } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireManager() {
  const user = await requireUser();
  if (!canManageAttendance(user)) {
    throw Response.json({ error: "Only a manager can manage attendance." }, { status: 403 });
  }
  return user;
}

// PATCH /api/attendance/workers/[id] — edit details or activate / deactivate a
// worker. Deactivating keeps their attendance history but hides them from the
// clocking kiosk.
export async function PATCH(req, { params }) {
  try {
    await requireManager();
  } catch (res) {
    return res;
  }
  const worker = await prisma.worker.findUnique({ where: { id: params.id } });
  if (!worker) return Response.json({ error: "Worker not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data = {};
  if (body.name !== undefined) {
    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) return Response.json({ error: "Name can't be blank." }, { status: 400 });
    data.name = name;
  }
  if (body.phone !== undefined) data.phone = String(body.phone || "").trim().slice(0, 40) || null;
  if (body.jobTitle !== undefined) data.jobTitle = String(body.jobTitle || "").trim().slice(0, 60) || null;
  if (body.active !== undefined) data.active = !!body.active;

  const updated = await prisma.worker.update({ where: { id: worker.id }, data });
  return Response.json({ ok: true, worker: { id: updated.id, active: updated.active } });
}
