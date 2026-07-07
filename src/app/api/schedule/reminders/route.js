import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { buildSchedule, scheduleReminderEmail } from "@/lib/schedule";
import { sendMail } from "@/lib/email";
import { TECH_TEMPLATES } from "@/lib/templates";

export const dynamic = "force-dynamic";

// GET/POST /api/schedule/reminders — emails everyone whose maintenance is
// overdue or due soon. Meant to be hit daily by a cron (Render cron job,
// GitHub Action, cron-job.org…) with the CRON_SECRET, e.g.:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://app/api/schedule/reminders
// A signed-in ADMIN may also trigger it manually from the schedule page.
async function run(req) {
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.get("authorization") || "";
  const key = new URL(req.url).searchParams.get("key") || "";
  const bySecret = secret && (auth === `Bearer ${secret}` || key === secret);

  if (!bySecret) {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN")
      return Response.json({ error: "Not allowed." }, { status: 401 });
  }

  // Full visibility for the schedule computation.
  const items = await buildSchedule({ role: "ADMIN" });
  const overdue = items.filter((i) => i.status === "OVERDUE");
  const dueSoon = items.filter((i) => i.status === "DUE_SOON");

  if (overdue.length === 0 && dueSoon.length === 0)
    return Response.json({ ok: true, overdue: 0, dueSoon: 0, emails: [] });

  // Recipients: the configured alert list, plus each technician whose own
  // plant/site has tech-form items due.
  const recipients = new Map(); // email -> { overdue: [], dueSoon: [] }
  const add = (email, item) => {
    const e = String(email || "").trim().toLowerCase();
    if (!/\S+@\S+\.\S+/.test(e)) return;
    if (!recipients.has(e)) recipients.set(e, { overdue: [], dueSoon: [] });
    recipients.get(e)[item.status === "OVERDUE" ? "overdue" : "dueSoon"].push(item);
  };

  const alertList = (process.env.SCHEDULE_ALERT_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const email of alertList) for (const item of [...overdue, ...dueSoon]) add(email, item);

  const techs = await prisma.user.findMany({
    where: { role: "TECHNICIAN", active: true },
    select: { email: true, site: true, client: { select: { name: true } } },
  });
  for (const item of [...overdue, ...dueSoon]) {
    if (!TECH_TEMPLATES.includes(item.template)) continue;
    for (const t of techs) {
      if (t.client?.name === item.clientName && (t.site || "") === (item.site || ""))
        add(t.email, item);
    }
  }

  const emails = [];
  for (const [email, lists] of recipients) {
    const mail = await sendMail(scheduleReminderEmail(email, lists.overdue, lists.dueSoon));
    emails.push({ to: email, sent: mail.sent, reason: mail.reason });
  }

  return Response.json({ ok: true, overdue: overdue.length, dueSoon: dueSoon.length, emails });
}

export async function GET(req) {
  return run(req);
}
export async function POST(req) {
  return run(req);
}
