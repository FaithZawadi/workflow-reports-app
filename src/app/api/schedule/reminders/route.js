import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { dueStatus, scheduleReminderEmail } from "@/lib/schedule";
import { sendMail } from "@/lib/email";
import { TECH_TEMPLATES } from "@/lib/templates";
import {
  reminderLeadDays,
  escalateAfterDays,
  daysBetween,
  contractReminderEmail,
  escalationEmail,
} from "@/lib/contracts";
import { notifyUsers } from "@/lib/notify";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Email the client contact + QSL Technical Manager several times before each
// contract service falls due. Idempotent: each lead-time is recorded per cycle.
async function processContracts(now) {
  const settings = await getSettings();
  const leads = reminderLeadDays(settings.workflow.contractReminderDays);
  const contracts = await prisma.contract.findMany({ where: { active: true } });
  const results = [];
  for (const c of contracts) {
    const daysUntil = daysBetween(now, c.nextServiceAt);
    const reachedUnsent = leads.filter((L) => daysUntil <= L && !c.remindersSent.includes(L));
    if (reachedUnsent.length === 0) continue;
    const to = [c.clientEmail, c.technicalManagerEmail]
      .map((e) => String(e || "").trim())
      .filter((e) => /\S+@\S+\.\S+/.test(e));
    if (to.length === 0) continue;
    const mail = await sendMail(contractReminderEmail(to.join(", "), c, daysUntil));
    await prisma.contract.update({
      where: { id: c.id },
      data: { remindersSent: [...new Set([...c.remindersSent, ...reachedUnsent])] },
    });
    results.push({ contract: c.name, to, daysUntil, sent: mail.sent, reason: mail.reason });
  }
  return results;
}

// Escalate reports that have sat at one approval stage too long. Once only
// (escalatedAt), so it doesn't repeat every run.
async function processEscalations(now, alertList) {
  const settings = await getSettings();
  const cutoff = new Date(now.getTime() - escalateAfterDays(settings.workflow.escalateAfterDays) * 86400000);
  const stale = await prisma.report.findMany({
    where: { status: { in: ["PENDING_SUPERVISOR", "PENDING_MANAGER"] }, createdAt: { lt: cutoff }, escalatedAt: null },
  });
  if (stale.length === 0) return [];
  // Oversight recipients: admins + technical managers.
  const oversight = await prisma.user.findMany({
    where: { active: true, roles: { hasSome: ["ADMIN", "TECHNICAL_MANAGER"] } },
    select: { id: true, email: true },
  });
  const oversightEmails = oversight.map((u) => u.email);
  const oversightIds = oversight.map((u) => u.id);
  const results = [];
  for (const r of stale) {
    const daysPending = daysBetween(r.createdAt, now);
    const up = r.status === "PENDING_SUPERVISOR" ? [r.managerEmail] : [];
    const to = [...new Set([...up, ...oversightEmails, ...alertList])]
      .map((e) => String(e || "").trim())
      .filter((e) => /\S+@\S+\.\S+/.test(e));
    if (to.length) {
      const mail = await sendMail(escalationEmail(to.join(", "), r, daysPending));
      results.push({ serial: r.serial, daysPending, to, sent: mail.sent, reason: mail.reason });
    }
    await notifyUsers(oversightIds, {
      type: "SYSTEM",
      title: `Escalated · ${r.serial}`,
      body: `Awaiting ${r.status === "PENDING_SUPERVISOR" ? "review" : "approval"} for ${daysPending} day(s)`,
      link: `/reports/${r.serial}`,
    });
    await prisma.report.update({ where: { id: r.id }, data: { escalatedAt: now } });
  }
  return results;
}

// Nudge a quote's preparer to record whether it was accepted or declined, once
// it has been issued (status QUOTED) for `quoteFollowupDays` without a decision.
// Repeats every interval until decided.
async function processQuoteFollowups(now) {
  const settings = await getSettings();
  const days = Number(settings.workflow.quoteFollowupDays) || 0;
  if (days <= 0) return [];
  const cutoff = new Date(now.getTime() - days * 86400000);
  const pending = await prisma.quotation.findMany({
    where: {
      status: "QUOTED",
      quotedAt: { lte: cutoff },
      requestedById: { not: null },
      OR: [{ followupSentAt: null }, { followupSentAt: { lte: cutoff } }],
    },
    select: { id: true, number: true, clientName: true, requestedById: true, quotedAt: true, currency: true, grandTotal: true },
  });
  const results = [];
  for (const q of pending) {
    const waiting = daysBetween(q.quotedAt, now);
    try {
      await notifyUsers([q.requestedById], {
        type: "APPROVAL",
        title: `Awaiting decision · ${q.number}`,
        body: `${q.clientName} — quoted ${waiting} day(s) ago. Has it been accepted? Record accepted or declined.`,
        link: `/quotations/${q.id}`,
      });
    } catch {
      /* best-effort */
    }
    await prisma.quotation.update({ where: { id: q.id }, data: { followupSentAt: now } });
    results.push({ number: q.number, waiting });
  }
  return results;
}

// GET/POST /api/schedule/reminders — emails everyone whose maintenance is
// overdue or due soon. Meant to be hit daily by a cron (Render cron job,
// GitHub Action, cron-job.org…) with the CRON_SECRET, e.g.:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://app/api/schedule/reminders
// A signed-in ADMIN may also trigger it manually.
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

  const now = new Date();
  const alertList = (process.env.SCHEDULE_ALERT_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // 1) Preventive-maintenance schedule reminders (overdue / due soon).
  const rows = await prisma.schedule.findMany({ where: { active: true } });
  const items = rows.map((r) => {
    const { status, days } = dueStatus(r.nextDueAt, r.frequency);
    return { ...r, dueState: status, dueDays: days };
  });
  const overdue = items.filter((i) => i.dueState === "OVERDUE");
  const dueSoon = items.filter((i) => i.dueState === "DUE_SOON");

  const emails = [];
  if (overdue.length || dueSoon.length) {
    // Recipients: the configured alert list (everything), each schedule's own
    // assignee, and technicians whose plant/site has tech-form items due.
    const recipients = new Map(); // email -> { overdue: [], dueSoon: [] }
    const add = (email, item) => {
      const e = String(email || "").trim().toLowerCase();
      if (!/\S+@\S+\.\S+/.test(e)) return;
      if (!recipients.has(e)) recipients.set(e, { overdue: [], dueSoon: [] });
      recipients.get(e)[item.dueState === "OVERDUE" ? "overdue" : "dueSoon"].push(item);
    };

    for (const email of alertList) for (const item of [...overdue, ...dueSoon]) add(email, item);
    for (const item of [...overdue, ...dueSoon]) if (item.assignedEmail) add(item.assignedEmail, item);

    const techs = await prisma.user.findMany({
      where: { role: "TECHNICIAN", active: true },
      select: { email: true, site: true, client: { select: { name: true } } },
    });
    for (const item of [...overdue, ...dueSoon]) {
      if (!TECH_TEMPLATES.includes(item.template)) continue;
      for (const t of techs) {
        if (t.client?.name === item.clientName && (t.site || "") === (item.site || "")) add(t.email, item);
      }
    }

    for (const [email, lists] of recipients) {
      const mail = await sendMail(scheduleReminderEmail(email, lists.overdue, lists.dueSoon));
      emails.push({ to: email, sent: mail.sent, reason: mail.reason });
    }
  }

  // 2) Contract service reminders (client + Technical Manager, several times).
  const contracts = await processContracts(now);
  // 3) Escalation of stale pending approvals.
  const escalations = await processEscalations(now, alertList);
  // 4) Nudge quote preparers to record accepted/declined.
  const quoteFollowups = await processQuoteFollowups(now);

  return Response.json({
    ok: true,
    overdue: overdue.length,
    dueSoon: dueSoon.length,
    emails,
    contracts,
    escalations,
    quoteFollowups,
  });
}

export async function GET(req) {
  return run(req);
}
export async function POST(req) {
  return run(req);
}
