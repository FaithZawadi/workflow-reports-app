import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { resolveManagerId } from "@/lib/weighbridge";

// PATCH /api/weighbridges/[id] — administrators edit a weighbridge.
export async function PATCH(req, { params }) {
  let user;
  try {
    user = await requireUser(["ADMIN"]);
  } catch (res) {
    return res;
  }
  const existing = await prisma.weighbridge.findUnique({ where: { id: params.id } });
  if (!existing) return Response.json({ error: "Weighbridge not found." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const data = {};
  if (b.label !== undefined) {
    const l = String(b.label).trim();
    if (!l) return Response.json({ error: "Name/ID can't be empty." }, { status: 400 });
    data.label = l;
  }
  if (b.clientName !== undefined) {
    const cn = String(b.clientName).trim();
    if (cn) {
      const c = await prisma.client.upsert({ where: { name: cn }, create: { name: cn }, update: {} });
      data.clientId = c.id;
    }
  }
  for (const k of ["site", "makeModel", "serialNo", "capacity", "deckLength"]) {
    if (b[k] !== undefined) data[k] = String(b[k]).trim() || null;
  }
  if (b.clientManagerId !== undefined) data.clientManagerId = await resolveManagerId(b.clientManagerId);
  if (b.active !== undefined) data.active = !!b.active;

  const w = await prisma.weighbridge.update({ where: { id: params.id }, data });
  await recordAudit({
    actor: user,
    action: "UPDATE",
    entity: "WEIGHBRIDGE",
    entityId: w.id,
    summary: `Updated weighbridge ${w.label}`,
  });
  return Response.json({ ok: true });
}

// DELETE /api/weighbridges/[id]
export async function DELETE(req, { params }) {
  let user;
  try {
    user = await requireUser(["ADMIN"]);
  } catch (res) {
    return res;
  }
  const existing = await prisma.weighbridge.findUnique({ where: { id: params.id } });
  if (!existing) return Response.json({ error: "Weighbridge not found." }, { status: 404 });
  await prisma.weighbridge.delete({ where: { id: params.id } });
  await recordAudit({
    actor: user,
    action: "DELETE",
    entity: "WEIGHBRIDGE",
    entityId: existing.id,
    summary: `Deleted weighbridge ${existing.label}`,
  });
  return Response.json({ ok: true });
}
