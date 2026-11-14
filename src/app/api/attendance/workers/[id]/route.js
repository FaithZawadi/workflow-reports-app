import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { canManageAttendance } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clean = (v, n) => String(v || "").trim().slice(0, n) || null;

async function requireManager() {
  const user = await requireUser();
  if (!canManageAttendance(user)) {
    throw Response.json({ error: "Only a manager can manage attendance." }, { status: 403 });
  }
  return user;
}

// PATCH /api/attendance/workers/[id] — reassign the worker's site, update contact
// details, or activate / deactivate them. Identity (name, ID number, ID document
// and face) is fixed at registration and cannot be changed here. Every change is
// written to the audit log.
export async function PATCH(req, { params }) {
  let user;
  try {
    user = await requireManager();
  } catch (res) {
    return res;
  }
  const worker = await prisma.worker.findUnique({ where: { id: params.id } });
  if (!worker) return Response.json({ error: "Worker not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Identity is locked — refuse attempts to change it rather than silently drop.
  for (const k of ["name", "idNumber", "idPhoto", "photo", "faceDescriptor"]) {
    if (body[k] !== undefined) {
      return Response.json({ error: "A worker's identity can't be changed once registered. You can reassign their site or update contact details." }, { status: 400 });
    }
  }

  const data = {};
  const changes = [];

  // Site reassignment (the main thing that may change).
  if (body.siteId !== undefined) {
    let siteId = null;
    let siteName = null;
    if (body.siteId) {
      const site = await prisma.site.findUnique({ where: { id: String(body.siteId) }, select: { id: true, name: true } });
      if (!site) return Response.json({ error: "That site wasn't found." }, { status: 400 });
      siteId = site.id;
      siteName = site.name;
    }
    if (siteId !== worker.siteId) {
      data.siteId = siteId;
      data.siteName = siteName;
      changes.push(`site ${worker.siteName || "—"} → ${siteName || "—"}`);
    }
  }

  // Non-identity contact / role updates.
  const fields = { phone: 40, jobTitle: 60, address: 200, nextOfKin: 120, nextOfKinPhone: 40, gender: 20 };
  for (const [k, n] of Object.entries(fields)) {
    if (body[k] !== undefined) {
      const v = clean(body[k], n);
      if (v !== worker[k]) { data[k] = v; changes.push(k); }
    }
  }

  if (body.active !== undefined && !!body.active !== worker.active) {
    data.active = !!body.active;
    changes.push(body.active ? "reactivated" : "deactivated");
  }

  if (Object.keys(data).length === 0) return Response.json({ error: "Nothing to change." }, { status: 400 });

  const updated = await prisma.worker.update({ where: { id: worker.id }, data });

  await recordAudit({
    actor: user,
    action: "UPDATE",
    entity: "WORKER",
    entityId: worker.id,
    summary: `Worker "${worker.name}" updated by ${user.name}: ${changes.join(", ")}`,
  });

  return Response.json({ ok: true, worker: { id: updated.id, active: updated.active, siteId: updated.siteId, siteName: updated.siteName } });
}
