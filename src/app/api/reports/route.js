import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { reportScope } from "@/lib/rbac";
import { nextSerial } from "@/lib/serial";
import { templateByCode, templatesForRoles } from "@/lib/templates";
import { sendMail, reviewRequestEmail, failureAlertEmail } from "@/lib/email";
import { addCycle } from "@/lib/schedule";
import { recordAudit } from "@/lib/audit";
import { FILER_ROLES, rolesOf } from "@/lib/roles";
import { notifyEmails, notifyUsers, oversight } from "@/lib/notify";

const isEmail = (v) => /\S+@\S+\.\S+/.test(v || "");

// GET /api/reports?status=&q=&template=
export async function GET(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const template = searchParams.get("template");
  const q = (searchParams.get("q") || "").trim();
  const name = (searchParams.get("name") || "").trim();
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();

  const where = { AND: [reportScope(user)] };
  if (status && status !== "all") where.AND.push({ status });
  if (template) where.AND.push({ template });
  if (q) {
    where.AND.push({
      OR: [
        { serial: { contains: q, mode: "insensitive" } },
        { templateName: { contains: q, mode: "insensitive" } },
        { authorName: { contains: q, mode: "insensitive" } },
        { clientName: { contains: q, mode: "insensitive" } },
        { site: { contains: q, mode: "insensitive" } },
        { weighbridgeId: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  // Filter by the name of the person who filed the report (or the client/plant).
  if (name) {
    where.AND.push({
      OR: [
        { authorName: { contains: name, mode: "insensitive" } },
        { clientName: { contains: name, mode: "insensitive" } },
      ],
    });
  }

  // Filter by the date the report was filed (inclusive range, local calendar days).
  const createdAt = {};
  const fromDate = from ? new Date(`${from}T00:00:00`) : null;
  if (fromDate && !isNaN(fromDate)) createdAt.gte = fromDate;
  const toDate = to ? new Date(`${to}T23:59:59.999`) : null;
  if (toDate && !isNaN(toDate)) createdAt.lte = toDate;
  if (createdAt.gte || createdAt.lte) where.AND.push({ createdAt });

  const reports = await prisma.report.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      serial: true,
      template: true,
      templateName: true,
      status: true,
      clientName: true,
      site: true,
      weighbridgeId: true,
      authorName: true,
      supervisorEmail: true,
      managerEmail: true,
      createdAt: true,
    },
  });

  return Response.json({ reports });
}

// POST /api/reports  — create a new report
export async function POST(req) {
  let user;
  try {
    user = await requireUser(FILER_ROLES);
  } catch (res) {
    return res;
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const tpl = templateByCode(body.template);
  if (!tpl) return Response.json({ error: "Unknown form type." }, { status: 400 });

  // A user files any form allowed by any of their roles. Technicians file
  // WB01-03, engineers WB04-06; supervisors, managers and admins file anything.
  // A user holding several roles gets the union.
  const allowedTemplates = templatesForRoles(rolesOf(user));
  if (!allowedTemplates.some((t) => t.code === tpl.code))
    return Response.json({ error: "This form is not available for your role." }, { status: 403 });

  const supervisorEmail = String(body.supervisorEmail || "").trim();
  const managerEmail = String(body.managerEmail || "").trim();
  if (!isEmail(supervisorEmail))
    return Response.json({ error: "Enter the supervisor's email." }, { status: 400 });
  if (!isEmail(managerEmail))
    return Response.json({ error: "Enter the manager's email." }, { status: 400 });

  // Client/site come from the form for every role (same fields for all). If a
  // technician leaves them blank, fall back to their assigned plant/site.
  let clientName = String(body.clientName || "").trim();
  let clientId = null;
  if (!clientName && user.clientId) {
    const c = await prisma.client.findUnique({ where: { id: user.clientId } });
    clientName = c?.name || "";
    clientId = user.clientId;
  }
  if (!clientName) return Response.json({ error: "Choose the client (plant)." }, { status: 400 });
  if (!clientId) {
    const client = await prisma.client.upsert({
      where: { name: clientName },
      create: { name: clientName },
      update: {},
    });
    clientId = client.id;
  }

  const site = String(body.site || "").trim() || user.site || "";
  const data = {
    values: body.values || {},
    checks: body.checks || {},
    grids: body.grids || {},
    runs: body.runs || {},
  };

  // WB02 weekly End-Middle-End verdict.
  if (tpl.code === "WB02") {
    const runs = data.runs;
    const diffs = [1, 2].map((r) => {
      const a = parseFloat(runs[`${r}a`]);
      const m = parseFloat(runs[`${r}m`]);
      const b = parseFloat(runs[`${r}b`]);
      if ([a, m, b].some((n) => isNaN(n))) return null;
      return Math.max(a, m, b) - Math.min(a, m, b);
    });
    const limit = parseFloat(data.values.limit);
    const worst = Math.max(...diffs.map((d) => (d == null ? 0 : d)));
    const pass = diffs.every((d) => d == null) || isNaN(limit) ? null : worst <= limit;
    data.weekly = { diffs, limit: data.values.limit ?? null, worst, pass };
  }

  const serial = await nextSerial(tpl.code);
  const authorName = user.name;

  const photos = Array.isArray(body.photos) ? body.photos.slice(0, 8) : [];

  const report = await prisma.report.create({
    data: {
      serial,
      template: tpl.code,
      templateName: tpl.name,
      status: "PENDING_SUPERVISOR",
      clientId,
      clientName,
      site: site || null,
      weighbridgeId: String(body.weighbridgeId || "").trim() || null,
      authorId: user.sub,
      authorName,
      supervisorEmail,
      managerEmail,
      data,
      photos: {
        create: photos.map((p, i) => ({
          dataUrl: String(p.src || p.dataUrl || ""),
          caption: p.caption || null,
          takenAt: p.takenAt ? new Date(p.takenAt) : null,
          gpsLat: p.gps?.lat ?? null,
          gpsLng: p.gps?.lng ?? null,
          gpsAcc: p.gps?.acc ?? null,
          order: i,
        })),
      },
      trailEvents: {
        create: [{ action: "Submitted", byName: authorName, byUserId: user.sub }],
      },
    },
  });

  await recordAudit({
    actor: user,
    action: "CREATE",
    entity: "REPORT",
    entityId: report.serial,
    summary: `Filed ${tpl.code} ${report.serial} for ${clientName}${site ? " - " + site : ""}`,
  });

  // Advance the matching maintenance schedule, if any (best-effort — never blocks filing).
  let scheduleAdvanced = false;
  try {
    let sched = null;
    if (body.scheduleId) {
      sched = await prisma.schedule.findUnique({ where: { id: String(body.scheduleId) } });
      if (sched && sched.template !== tpl.code) sched = null;
    }
    if (!sched && clientId) {
      sched = await prisma.schedule.findFirst({
        where: {
          active: true,
          template: tpl.code,
          clientId,
          ...(report.weighbridgeId ? { weighbridgeId: report.weighbridgeId } : {}),
        },
        orderBy: { nextDueAt: "asc" },
      });
    }
    if (sched) {
      const now = new Date();
      const base = now > new Date(sched.nextDueAt) ? now : new Date(sched.nextDueAt);
      await prisma.schedule.update({
        where: { id: sched.id },
        data: {
          lastDoneAt: now,
          nextDueAt: addCycle(base, sched.frequency, sched.intervalDays),
          lastReportSerial: report.serial,
        },
      });
      scheduleAdvanced = true;
    }
  } catch {
    // scheduling is best-effort
  }

  // Notify the Equipment User (reviewer) — email + in-app.
  const mail = await sendMail(reviewRequestEmail(report));
  await notifyEmails([report.supervisorEmail], {
    type: "REVIEW",
    title: `Review needed · ${report.serial}`,
    body: `${report.templateName} — ${report.clientName}${report.site ? " - " + report.site : ""}, by ${report.authorName}`,
    link: `/reports/${report.serial}`,
  });

  // System / equipment failure alert — flag over-limit weekly tests, any items
  // marked for attention, and breakdown reports to management + oversight.
  const reasons = [];
  if (tpl.code === "WB02" && data.weekly && data.weekly.pass === false) reasons.push("Weekly accuracy test OVER LIMIT");
  const flagged = Object.values(data.checks || {}).filter((v) => v && v.state && !["ok", "pass", "na"].includes(v.state)).length;
  if (flagged > 0) reasons.push(`${flagged} item(s) flagged for attention`);
  if (tpl.code === "WB05") reasons.push("Breakdown / corrective service logged");

  if (reasons.length) {
    const ov = await oversight();
    const mgmtEmails = [report.managerEmail].filter(isEmail);
    const emailTo = [...new Set([...mgmtEmails, ...ov.emails])].filter(isEmail);
    if (emailTo.length) await sendMail(failureAlertEmail(emailTo.join(", "), report, reasons));
    await notifyUsers(ov.ids, {
      type: "FAILURE",
      title: `Attention needed · ${report.serial}`,
      body: `${reasons.join("; ")} — ${report.clientName}`,
      link: `/reports/${report.serial}`,
    });
    await notifyEmails(mgmtEmails, {
      type: "FAILURE",
      title: `Attention needed · ${report.serial}`,
      body: reasons.join("; "),
      link: `/reports/${report.serial}`,
    });
  }

  return Response.json({
    serial: report.serial,
    emailSent: mail.sent,
    emailReason: mail.reason,
    scheduleAdvanced,
  });
}
