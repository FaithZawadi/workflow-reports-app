import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { clientDetailData } from "@/lib/clientFields";

// PATCH /api/clients/[id] — rename or activate/deactivate a client (admin).
export async function PATCH(req, { params }) {
  let user;
  try {
    user = await requireUser(["ADMIN"]);
  } catch (res) {
    return res;
  }
  const existing = await prisma.client.findUnique({ where: { id: params.id } });
  if (!existing) return Response.json({ error: "Client not found." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const data = {};
  if (b.name !== undefined) {
    const n = String(b.name).trim();
    if (!n) return Response.json({ error: "Name can't be empty." }, { status: 400 });
    const clash = await prisma.client.findFirst({ where: { name: { equals: n, mode: "insensitive" }, id: { not: params.id } } });
    if (clash) return Response.json({ error: "Another client already uses that name." }, { status: 409 });
    data.name = n;
  }
  if (b.active !== undefined) data.active = !!b.active;
  Object.assign(data, clientDetailData(b));

  const c = await prisma.client.update({ where: { id: params.id }, data });
  await recordAudit({ actor: user, action: "UPDATE", entity: "CLIENT", entityId: c.id, summary: `Updated client ${c.name}` });
  return Response.json({ ok: true });
}

// DELETE /api/clients/[id] — remove a client only when nothing references it;
// otherwise deactivate (keeps historical reports intact).
export async function DELETE(req, { params }) {
  let user;
  try {
    user = await requireUser(["ADMIN"]);
  } catch (res) {
    return res;
  }
  const existing = await prisma.client.findUnique({
    where: { id: params.id },
    include: { _count: { select: { reports: true, weighbridges: true, schedules: true, contracts: true } } },
  });
  if (!existing) return Response.json({ error: "Client not found." }, { status: 404 });

  const refs = existing._count.reports + existing._count.weighbridges + existing._count.schedules + existing._count.contracts;
  if (refs > 0) {
    // Preserve history — deactivate instead of a destructive delete.
    await prisma.client.update({ where: { id: params.id }, data: { active: false } });
    await recordAudit({ actor: user, action: "UPDATE", entity: "CLIENT", entityId: existing.id, summary: `Deactivated client ${existing.name} (has ${refs} linked record${refs === 1 ? "" : "s"})` });
    return Response.json({ ok: true, deactivated: true });
  }

  await prisma.client.delete({ where: { id: params.id } }); // sites cascade
  await recordAudit({ actor: user, action: "DELETE", entity: "CLIENT", entityId: existing.id, summary: `Deleted client ${existing.name}` });
  return Response.json({ ok: true, deleted: true });
}
