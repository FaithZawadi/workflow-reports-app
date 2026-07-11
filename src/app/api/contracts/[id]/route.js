import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { TASK_MANAGER_ROLES } from "@/lib/roles";
import { advanceContract } from "@/lib/contracts";

const FREQS = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM"];

// PATCH /api/contracts/[id] — edit a contract, or mark a service done
// (body.markServiced=true) which rolls the next service date forward one cycle
// and clears the reminder history so the next cycle's reminders fire afresh.
export async function PATCH(req, { params }) {
  let user;
  try {
    user = await requireUser(TASK_MANAGER_ROLES);
  } catch (res) {
    return res;
  }
  const c = await prisma.contract.findUnique({ where: { id: params.id } });
  if (!c) return Response.json({ error: "Contract not found." }, { status: 404 });

  const b = await req.json().catch(() => ({}));

  if (b.markServiced) {
    const next = advanceContract(c);
    await prisma.contract.update({
      where: { id: c.id },
      data: { lastServiceAt: new Date(), nextServiceAt: next, remindersSent: [] },
    });
    await recordAudit({ actor: user, action: "UPDATE", entity: "CONTRACT", entityId: c.id, summary: `Service completed for contract ${c.name}` });
    return Response.json({ ok: true });
  }

  const data = {};
  if (b.name !== undefined) {
    const n = String(b.name).trim();
    if (!n) return Response.json({ error: "Name can't be empty." }, { status: 400 });
    data.name = n;
  }
  if (b.clientName !== undefined) {
    const cn = String(b.clientName).trim();
    if (cn) {
      const client = await prisma.client.upsert({ where: { name: cn }, create: { name: cn }, update: {} });
      data.clientId = client.id;
      data.clientName = cn;
    }
  }
  if (b.clientEmail !== undefined) data.clientEmail = String(b.clientEmail).trim() || null;
  if (b.technicalManagerEmail !== undefined) data.technicalManagerEmail = String(b.technicalManagerEmail).trim() || null;
  if (b.frequency !== undefined && FREQS.includes(b.frequency)) data.frequency = b.frequency;
  if (b.intervalDays !== undefined) data.intervalDays = Number(b.intervalDays) || null;
  if (b.startDate !== undefined) data.startDate = b.startDate ? new Date(b.startDate) : null;
  if (b.endDate !== undefined) data.endDate = b.endDate ? new Date(b.endDate) : null;
  if (b.nextServiceAt !== undefined && b.nextServiceAt) {
    const d = new Date(b.nextServiceAt);
    if (!isNaN(d)) {
      data.nextServiceAt = d;
      data.remindersSent = []; // a changed due date restarts the reminder cycle
    }
  }
  if (b.notes !== undefined) data.notes = String(b.notes).trim() || null;
  if (b.active !== undefined) data.active = !!b.active;

  if (Object.keys(data).length === 0) return Response.json({ error: "Nothing to update." }, { status: 400 });
  const updated = await prisma.contract.update({ where: { id: c.id }, data });
  await recordAudit({ actor: user, action: "UPDATE", entity: "CONTRACT", entityId: updated.id, summary: `Updated contract ${updated.name}` });
  return Response.json({ ok: true });
}

// DELETE /api/contracts/[id]
export async function DELETE(req, { params }) {
  let user;
  try {
    user = await requireUser(TASK_MANAGER_ROLES);
  } catch (res) {
    return res;
  }
  const c = await prisma.contract.findUnique({ where: { id: params.id } });
  if (!c) return Response.json({ error: "Contract not found." }, { status: 404 });
  await prisma.contract.delete({ where: { id: params.id } });
  await recordAudit({ actor: user, action: "DELETE", entity: "CONTRACT", entityId: c.id, summary: `Deleted contract ${c.name}` });
  return Response.json({ ok: true });
}
