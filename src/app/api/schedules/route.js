import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { templateByCode } from "@/lib/templates";
import {
  FREQUENCIES,
  addCycle,
  dueStatus,
  scheduleScope,
  canManageTemplate,
} from "@/lib/schedule";
import { recordAudit } from "@/lib/audit";
import { SCHEDULE_MANAGER_ROLES } from "@/lib/roles";
import { sendMail, scheduleAssignedEmail } from "@/lib/email";
import { notifyEmails } from "@/lib/notify";

const isEmail = (v) => /\S+@\S+\.\S+/.test(v || "");

function withStatus(row) {
  const { status, days } = dueStatus(row.nextDueAt, row.frequency);
  return { ...row, dueState: status, dueDays: days };
}

// GET /api/schedules?status=&template=&client=&q=
export async function GET(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }

  const { searchParams } = new URL(req.url);
  const template = searchParams.get("template");
  const client = (searchParams.get("client") || "").trim();
  const q = (searchParams.get("q") || "").trim();
  const activeParam = searchParams.get("active");

  const where = { AND: [scheduleScope(user)] };
  if (activeParam !== "all") where.AND.push({ active: true });
  if (template) where.AND.push({ template });
  if (client) where.AND.push({ clientName: { equals: client, mode: "insensitive" } });
  if (q) {
    where.AND.push({
      OR: [
        { clientName: { contains: q, mode: "insensitive" } },
        { site: { contains: q, mode: "insensitive" } },
        { weighbridgeId: { contains: q, mode: "insensitive" } },
        { templateName: { contains: q, mode: "insensitive" } },
        { assignedName: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const rows = await prisma.schedule.findMany({
    where,
    orderBy: { nextDueAt: "asc" },
    take: 1000,
  });

  const schedules = rows.map(withStatus);
  const summary = schedules.reduce(
    (acc, s) => {
      if (s.dueState === "OVERDUE") acc.overdue += 1;
      else if (s.dueState === "DUE_SOON") acc.dueSoon += 1;
      else acc.scheduled += 1;
      return acc;
    },
    { overdue: 0, dueSoon: 0, scheduled: 0, total: schedules.length }
  );

  return Response.json({ schedules, summary });
}

// POST /api/schedules — create a maintenance schedule
export async function POST(req) {
  let user;
  try {
    user = await requireUser(SCHEDULE_MANAGER_ROLES);
  } catch (res) {
    return res;
  }

  const body = await req.json().catch(() => ({}));

  const tpl = templateByCode(body.template);
  if (!tpl) return Response.json({ error: "Choose a valid form." }, { status: 400 });
  if (!canManageTemplate(user, tpl.code))
    return Response.json({ error: "You can't schedule this form type." }, { status: 403 });

  const frequency = String(body.frequency || "").toUpperCase();
  if (!FREQUENCIES[frequency])
    return Response.json({ error: "Choose how often it repeats." }, { status: 400 });
  const intervalDays =
    frequency === "CUSTOM" ? Math.max(1, parseInt(body.intervalDays, 10) || 0) : null;
  if (frequency === "CUSTOM" && !intervalDays)
    return Response.json({ error: "Enter the custom interval in days." }, { status: 400 });

  const clientName = String(body.clientName || "").trim();
  if (!clientName) return Response.json({ error: "Choose the client (plant)." }, { status: 400 });
  const weighbridgeId = String(body.weighbridgeId || "").trim();
  if (!weighbridgeId)
    return Response.json({ error: "Enter the weighbridge ID this applies to." }, { status: 400 });

  if (body.assignedEmail && !isEmail(body.assignedEmail))
    return Response.json({ error: "The assignee email looks wrong." }, { status: 400 });

  // First due date: use provided, else start one cycle from today.
  let nextDueAt;
  if (body.firstDueAt) {
    const d = new Date(body.firstDueAt);
    if (isNaN(d)) return Response.json({ error: "The first-due date is invalid." }, { status: 400 });
    nextDueAt = d;
  } else {
    nextDueAt = addCycle(new Date(), frequency, intervalDays);
  }

  const client = await prisma.client.upsert({
    where: { name: clientName },
    create: { name: clientName },
    update: {},
  });

  const schedule = await prisma.schedule.create({
    data: {
      clientId: client.id,
      clientName,
      site: String(body.site || "").trim() || null,
      weighbridgeId,
      template: tpl.code,
      templateName: tpl.name,
      frequency,
      intervalDays,
      assignedName: String(body.assignedName || "").trim() || null,
      assignedEmail: String(body.assignedEmail || "").trim() || null,
      nextDueAt,
      notes: String(body.notes || "").trim() || null,
      createdById: user.sub,
    },
  });

  await recordAudit({
    actor: user,
    action: "CREATE",
    entity: "SCHEDULE",
    entityId: schedule.id,
    summary: `Created ${tpl.code} ${FREQUENCIES[frequency]?.label || frequency} schedule for ${clientName} · ${weighbridgeId}` +
      (schedule.assignedName ? ` → ${schedule.assignedName}` : ""),
  });

  // Notify the assignee that they've been scheduled — email + in-app.
  if (schedule.assignedEmail) {
    await sendMail(scheduleAssignedEmail(schedule.assignedEmail, schedule));
    await notifyEmails([schedule.assignedEmail], {
      type: "SCHEDULE",
      title: "You've been scheduled",
      body: `${schedule.templateName} — ${schedule.clientName} · ${schedule.weighbridgeId} (first due ${new Date(schedule.nextDueAt).toLocaleDateString()})`,
      link: "/schedule",
    });
  }

  return Response.json({ schedule: withStatus(schedule) });
}
