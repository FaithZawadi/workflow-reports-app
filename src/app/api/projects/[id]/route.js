import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { TASK_MANAGER_ROLES } from "@/lib/roles";

// PATCH /api/projects/[id] — managers/admin edit a project.
export async function PATCH(req, { params }) {
  let user;
  try {
    user = await requireUser(TASK_MANAGER_ROLES);
  } catch (res) {
    return res;
  }
  const existing = await prisma.project.findUnique({ where: { id: params.id } });
  if (!existing) return Response.json({ error: "Project not found." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const data = {};
  if (b.name !== undefined) {
    const n = String(b.name).trim();
    if (!n) return Response.json({ error: "Name can't be empty." }, { status: 400 });
    data.name = n;
  }
  if (b.description !== undefined) data.description = String(b.description).trim() || null;
  if (b.clientName !== undefined) {
    const cn = String(b.clientName).trim();
    if (cn) {
      const c = await prisma.client.upsert({ where: { name: cn }, create: { name: cn }, update: {} });
      data.clientId = c.id;
    } else {
      data.clientId = null;
    }
  }
  if (b.active !== undefined) data.active = !!b.active;

  const p = await prisma.project.update({ where: { id: params.id }, data });
  await recordAudit({ actor: user, action: "UPDATE", entity: "PROJECT", entityId: p.id, summary: `Updated project ${p.name}` });
  return Response.json({ ok: true });
}

// DELETE /api/projects/[id] — tasks keep their history (projectId set null).
export async function DELETE(req, { params }) {
  let user;
  try {
    user = await requireUser(TASK_MANAGER_ROLES);
  } catch (res) {
    return res;
  }
  const existing = await prisma.project.findUnique({ where: { id: params.id } });
  if (!existing) return Response.json({ error: "Project not found." }, { status: 404 });
  await prisma.project.delete({ where: { id: params.id } });
  await recordAudit({ actor: user, action: "DELETE", entity: "PROJECT", entityId: existing.id, summary: `Deleted project ${existing.name}` });
  return Response.json({ ok: true });
}
