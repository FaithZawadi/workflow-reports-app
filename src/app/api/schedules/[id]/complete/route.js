import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addCycle, dueStatus } from "@/lib/schedule";
import { scheduleTemplateScope } from "@/lib/schedule";
import { rolesOf } from "@/lib/roles";

// POST /api/schedules/[id]/complete — record that the check was done and roll the
// next due date forward one cycle. Used for offline/paper completions; filing a
// report advances the schedule automatically.
export async function POST(req, { params }) {
  let user;
  try {
    user = await requireUser(["ADMIN", "PROJECT_MANAGER", "TECHNICAL_MANAGER", "TECHNICIAN", "ENGINEER"]);
  } catch (res) {
    return res;
  }

  const sch = await prisma.schedule.findUnique({ where: { id: params.id } });
  if (!sch) return Response.json({ error: "Schedule not found." }, { status: 404 });

  // Template scope check (technicians only their plant).
  const tpls = scheduleTemplateScope(user);
  if (tpls && !tpls.includes(sch.template))
    return Response.json({ error: "Not your schedule to complete." }, { status: 403 });
  if (rolesOf(user).includes("TECHNICIAN") && user.clientId && sch.clientId !== user.clientId)
    return Response.json({ error: "Not your plant's schedule." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const doneAt = body.doneAt ? new Date(body.doneAt) : new Date();
  if (isNaN(doneAt)) return Response.json({ error: "Invalid completion date." }, { status: 400 });

  // Roll forward from the later of "now" and the current due date so we don't
  // stack up several missed cycles at once.
  const base = doneAt > new Date(sch.nextDueAt) ? doneAt : new Date(sch.nextDueAt);
  const nextDueAt = addCycle(base, sch.frequency, sch.intervalDays);

  const schedule = await prisma.schedule.update({
    where: { id: params.id },
    data: {
      lastDoneAt: doneAt,
      nextDueAt,
      lastReportSerial: body.reportSerial || sch.lastReportSerial,
    },
  });

  const { status, days } = dueStatus(schedule.nextDueAt, schedule.frequency);
  return Response.json({ schedule: { ...schedule, dueState: status, dueDays: days } });
}
