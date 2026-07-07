import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { FREQUENCIES, dueStatus, canManageTemplate } from "@/lib/schedule";

const isEmail = (v) => /\S+@\S+\.\S+/.test(v || "");

function withStatus(row) {
  const { status, days } = dueStatus(row.nextDueAt, row.frequency);
  return { ...row, dueState: status, dueDays: days };
}

// PATCH /api/schedules/[id] — edit frequency, next-due, assignee, active, notes
export async function PATCH(req, { params }) {
  let user;
  try {
    user = await requireUser(["ADMIN", "PROJECT_MANAGER", "TECHNICAL_MANAGER"]);
  } catch (res) {
    return res;
  }

  const existing = await prisma.schedule.findUnique({ where: { id: params.id } });
  if (!existing) return Response.json({ error: "Schedule not found." }, { status: 404 });
  if (!canManageTemplate(user.role, existing.template))
    return Response.json({ error: "You can't edit this schedule." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data = {};

  if (body.frequency !== undefined) {
    const frequency = String(body.frequency).toUpperCase();
    if (!FREQUENCIES[frequency])
      return Response.json({ error: "Unknown frequency." }, { status: 400 });
    data.frequency = frequency;
    if (frequency === "CUSTOM") {
      const n = Math.max(1, parseInt(body.intervalDays ?? existing.intervalDays, 10) || 0);
      if (!n) return Response.json({ error: "Enter the custom interval in days." }, { status: 400 });
      data.intervalDays = n;
    } else {
      data.intervalDays = null;
    }
  } else if (body.intervalDays !== undefined && existing.frequency === "CUSTOM") {
    data.intervalDays = Math.max(1, parseInt(body.intervalDays, 10) || 1);
  }

  if (body.nextDueAt !== undefined) {
    const d = new Date(body.nextDueAt);
    if (isNaN(d)) return Response.json({ error: "Invalid due date." }, { status: 400 });
    data.nextDueAt = d;
  }
  if (body.active !== undefined) data.active = !!body.active;
  if (body.notes !== undefined) data.notes = String(body.notes).trim() || null;
  if (body.site !== undefined) data.site = String(body.site).trim() || null;
  if (body.weighbridgeId !== undefined) {
    const wb = String(body.weighbridgeId).trim();
    if (!wb) return Response.json({ error: "Weighbridge ID can't be empty." }, { status: 400 });
    data.weighbridgeId = wb;
  }
  if (body.assignedName !== undefined) data.assignedName = String(body.assignedName).trim() || null;
  if (body.assignedEmail !== undefined) {
    const em = String(body.assignedEmail).trim();
    if (em && !isEmail(em)) return Response.json({ error: "Assignee email looks wrong." }, { status: 400 });
    data.assignedEmail = em || null;
  }

  const schedule = await prisma.schedule.update({ where: { id: params.id }, data });
  return Response.json({ schedule: withStatus(schedule) });
}

// DELETE /api/schedules/[id]
export async function DELETE(req, { params }) {
  let user;
  try {
    user = await requireUser(["ADMIN", "PROJECT_MANAGER", "TECHNICAL_MANAGER"]);
  } catch (res) {
    return res;
  }
  const existing = await prisma.schedule.findUnique({ where: { id: params.id } });
  if (!existing) return Response.json({ error: "Schedule not found." }, { status: 404 });
  if (!canManageTemplate(user.role, existing.template))
    return Response.json({ error: "You can't delete this schedule." }, { status: 403 });

  await prisma.schedule.delete({ where: { id: params.id } });
  return Response.json({ ok: true });
}
