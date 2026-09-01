import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { reportScope } from "@/lib/rbac";
import { nextSerial } from "@/lib/serial";
import { templateByCode, templatesForRoles, isSingleApproval } from "@/lib/templates";
import { resolveClientByName } from "@/lib/clientResolve";
import { sendMail, reviewRequestEmail, failureAlertEmail } from "@/lib/email";
import { createApprovalLinks } from "@/lib/approvalToken";
import { addCycle } from "@/lib/schedule";
import { recordAudit } from "@/lib/audit";
import { isValidImageUpload, MAX_IMAGE_BYTES, isValidPdfUpload, MAX_PDF_BYTES, dataUrlBytes } from "@/lib/upload";
import { evalGeofence } from "@/lib/geofence";
import { getSettings } from "@/lib/settings";
import { chainFor, stageRole, stageLabel } from "@/lib/approvalChain";
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

  // Filter by the date the report is FOR (its service date), inclusive range of
  // local calendar days — so a backfilled report is found under the day the work
  // was actually done, not the day it was keyed in.
  const reportDate = {};
  const fromDate = from ? new Date(`${from}T00:00:00`) : null;
  if (fromDate && !isNaN(fromDate)) reportDate.gte = fromDate;
  const toDate = to ? new Date(`${to}T23:59:59.999`) : null;
  if (toDate && !isNaN(toDate)) reportDate.lte = toDate;
  if (reportDate.gte || reportDate.lte) where.AND.push({ reportDate });

  const reports = await prisma.report.findMany({
    where,
    orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
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
      reportDate: true,
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

  // One or more Equipment Users may be assigned. Accept `supervisorEmails` (an
  // array) and/or the legacy single `supervisorEmail`; any ONE of them can
  // review. Stored lower-cased so array membership checks are case-insensitive.
  const rawSupers = [
    ...(Array.isArray(body.supervisorEmails) ? body.supervisorEmails : []),
    body.supervisorEmail,
  ]
    .map((e) => String(e || "").trim())
    .filter(Boolean);
  const supervisorEmails = [...new Set(rawSupers.map((e) => e.toLowerCase()))].filter(isEmail);
  if (supervisorEmails.length === 0)
    return Response.json({ error: "Add at least one Equipment User email." }, { status: 400 });
  const supervisorEmail = supervisorEmails[0]; // primary (for display / routing snapshots)

  // Daily / weekly / monthly forms are single-stage: the one approver (labelled
  // "Client") signs off and the report is Approved — no manager stage, so a
  // manager email is not required.
  const single = isSingleApproval(tpl.code);
  const managerEmail = String(body.managerEmail || "").trim();
  if (!single && !isEmail(managerEmail))
    return Response.json({ error: "Enter the manager's email." }, { status: 400 });

  // Role-locked approval chain (e.g. Technical Report → Technical Manager then
  // Project Manager): the assigned approvers must actually hold the required
  // roles, so the report can only ever be signed off by the right people.
  const chain = chainFor(tpl.code);
  if (chain) {
    const emails = [...supervisorEmails, managerEmail].filter(Boolean);
    const approvers = await prisma.user.findMany({
      where: { email: { in: emails, mode: "insensitive" }, active: true },
      select: { email: true, role: true, roles: true },
    });
    const rolesByEmail = new Map(
      approvers.map((u) => [u.email.toLowerCase(), u.roles && u.roles.length ? u.roles : [u.role]])
    );
    const holds = (email, role) => (rolesByEmail.get(String(email).toLowerCase()) || []).includes(role);
    const supRole = stageRole(tpl.code, "SUPERVISOR");
    const mgrRole = stageRole(tpl.code, "MANAGER");
    if (!supervisorEmails.every((e) => holds(e, supRole)))
      return Response.json({ error: `The first approver must be a ${stageLabel(tpl.code, "SUPERVISOR")}.` }, { status: 400 });
    if (!single && !holds(managerEmail, mgrRole))
      return Response.json({ error: `The final approver must be a ${stageLabel(tpl.code, "MANAGER")}.` }, { status: 400 });
  }

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
    // Resolve case-insensitively so a stray-cased name reuses the same client
    // and the report's stored clientName matches the registry's canonical one.
    const client = await resolveClientByName(clientName);
    clientId = client.id;
    clientName = client.name;
  }

  const site = String(body.site || "").trim() || user.site || "";

  // Backdating is disabled — every new report is dated to now. (The reportDate
  // column is kept so the reporting layer keys off it uniformly.)
  const reportDate = new Date();

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

  // --- Geofencing: record where the report was filed and compare it to the
  // site's fence (proof of on-site attendance). Best-effort — the filer may
  // decline location, or the site may have no coordinates/radius. ---
  const fLat = Number(body.filedLat);
  const fLng = Number(body.filedLng);
  const fAcc = Number(body.filedAccuracy);
  const hasFiled = !Number.isNaN(fLat) && !Number.isNaN(fLng) && (fLat !== 0 || fLng !== 0);
  let siteRec = null;
  if (site) {
    siteRec = await prisma.site
      .findFirst({
        where: { name: { equals: site, mode: "insensitive" }, OR: [{ clientId }, { clientId: null }] },
        orderBy: { clientId: "desc" }, // prefer the client's own site over a global one
        select: { lat: true, lng: true, geofenceRadius: true },
      })
      .catch(() => null);
  }
  // Admin settings: apply a default fence radius where a site has none, and
  // optionally require the report to be filed on-site.
  const settings = await getSettings();
  const effectiveRadius = siteRec?.geofenceRadius ?? (settings.reports.defaultGeofenceRadius || null);
  const geo = evalGeofence({
    filedLat: hasFiled ? fLat : null,
    filedLng: hasFiled ? fLng : null,
    siteLat: siteRec?.lat ?? null,
    siteLng: siteRec?.lng ?? null,
    radiusM: effectiveRadius,
  });

  // Enforce on-site filing when the admin requires it: reject a clear miss (no
  // location captured, or outside the fence). A site with no coordinates can't
  // be verified either way, so it's allowed through.
  if (settings.reports.requireOnSite) {
    if (geo.status === "NO_LOCATION")
      return Response.json({ error: "Location is required to file this report. Allow location access and try again." }, { status: 422 });
    if (geo.status === "OUTSIDE")
      return Response.json({ error: "You appear to be off-site. This report must be filed at the site." }, { status: 422 });
  }

  const serial = await nextSerial(tpl.code);
  const authorName = user.name;

  // Photos are capped at 8, and each must be a real image within the size limit
  // — never trust the client (a direct API call could post huge or non-image
  // blobs). Reject the whole submission with a clear message if any fail.
  const photos = Array.isArray(body.photos) ? body.photos.slice(0, 8) : [];
  if (settings.reports.requirePhotos && photos.length === 0)
    return Response.json({ error: "At least one photo is required for this report." }, { status: 422 });
  for (const p of photos) {
    if (!isValidImageUpload(String(p?.src || p?.dataUrl || ""), MAX_IMAGE_BYTES)) {
      return Response.json({ error: "Each photo must be an image of 5 MB or less." }, { status: 413 });
    }
  }

  // Supporting PDF attachments (capped at 5). For a Site Instruction these pages
  // are appended to the generated document. Validate mime + size server-side.
  const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 5) : [];
  for (const a of attachments) {
    if (!isValidPdfUpload(String(a?.dataUrl || ""), MAX_PDF_BYTES)) {
      return Response.json({ error: "Each attachment must be a PDF of 15 MB or less." }, { status: 413 });
    }
  }

  const report = await prisma.report.create({
    data: {
      serial,
      template: tpl.code,
      templateName: tpl.name,
      status: "PENDING_SUPERVISOR",
      clientId,
      clientName,
      site: site || null,
      reportDate,
      weighbridgeId: String(body.weighbridgeId || "").trim() || null,
      // Geofence snapshot for this filing.
      filedLat: hasFiled ? fLat : null,
      filedLng: hasFiled ? fLng : null,
      filedAccuracy: hasFiled && !Number.isNaN(fAcc) ? fAcc : null,
      siteLat: siteRec?.lat ?? null,
      siteLng: siteRec?.lng ?? null,
      siteRadiusM: effectiveRadius,
      geofenceStatus: geo.status,
      geofenceDistanceM: geo.distanceM,
      authorId: user.sub,
      authorName,
      supervisorEmail,
      supervisorEmails,
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
      attachments: {
        create: attachments.map((a, i) => ({
          name: String(a.name || `attachment-${i + 1}.pdf`).slice(0, 200),
          mimeType: "application/pdf",
          dataUrl: String(a.dataUrl || ""),
          size: dataUrlBytes(String(a.dataUrl || "")),
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

  // Notify EVERY assigned Equipment User — each gets an email with their own
  // one-click approve/reject link (any one of them can review) + in-app.
  let mail = { sent: false, reason: "no reviewer" };
  for (const email of report.supervisorEmails) {
    const links = await createApprovalLinks(report, "SUPERVISOR", email);
    const r = await sendMail({ ...reviewRequestEmail(report, links), to: email });
    if (r?.sent) mail = r;
  }
  await notifyEmails(report.supervisorEmails, {
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
