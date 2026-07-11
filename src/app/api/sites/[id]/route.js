import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

// PATCH /api/sites/[id] — administrators edit a site / location.
export async function PATCH(req, { params }) {
  let user;
  try {
    user = await requireUser(["ADMIN"]);
  } catch (res) {
    return res;
  }
  const existing = await prisma.site.findUnique({ where: { id: params.id } });
  if (!existing) return Response.json({ error: "Site not found." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const data = {};
  if (b.name !== undefined) {
    const n = String(b.name).trim();
    if (!n) return Response.json({ error: "Name can't be empty." }, { status: 400 });
    data.name = n;
  }
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

  const s = await prisma.site.update({ where: { id: params.id }, data });
  await recordAudit({
    actor: user,
    action: "UPDATE",
    entity: "SITE",
    entityId: s.id,
    summary: `Updated site ${s.name}`,
  });
  return Response.json({ ok: true });
}

// DELETE /api/sites/[id]
export async function DELETE(req, { params }) {
  let user;
  try {
    user = await requireUser(["ADMIN"]);
  } catch (res) {
    return res;
  }
  const existing = await prisma.site.findUnique({ where: { id: params.id } });
  if (!existing) return Response.json({ error: "Site not found." }, { status: 404 });
  await prisma.site.delete({ where: { id: params.id } });
  await recordAudit({
    actor: user,
    action: "DELETE",
    entity: "SITE",
    entityId: existing.id,
    summary: `Deleted site ${existing.name}`,
  });
  return Response.json({ ok: true });
}
