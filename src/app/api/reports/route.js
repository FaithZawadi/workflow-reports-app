import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { reportScope } from "@/lib/rbac";
import { nextSerial } from "@/lib/serial";
import { templateByCode, TECH_TEMPLATES, ENGINEER_TEMPLATES } from "@/lib/templates";
import { sendMail, reviewRequestEmail } from "@/lib/email";

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
    user = await requireUser(["TECHNICIAN", "ENGINEER", "ADMIN"]);
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

  // Technicians file WB01-03; engineers file WB04-06.
  if (user.role === "TECHNICIAN" && !TECH_TEMPLATES.includes(tpl.code))
    return Response.json({ error: "This form is for QSL engineers." }, { status: 403 });
  if (user.role === "ENGINEER" && !ENGINEER_TEMPLATES.includes(tpl.code))
    return Response.json({ error: "This form is for site technicians." }, { status: 403 });

  const supervisorEmail = String(body.supervisorEmail || "").trim();
  const managerEmail = String(body.managerEmail || "").trim();
  if (!isEmail(supervisorEmail))
    return Response.json({ error: "Enter the supervisor's email." }, { status: 400 });
  if (!isEmail(managerEmail))
    return Response.json({ error: "Enter the manager's email." }, { status: 400 });

  // Resolve client. Technicians use their assigned client; others pass a name.
  let clientId = user.clientId || null;
  let clientName = "";
  if (user.role === "TECHNICIAN" && clientId) {
    const c = await prisma.client.findUnique({ where: { id: clientId } });
    clientName = c?.name || String(body.clientName || "");
  } else {
    clientName = String(body.clientName || "").trim();
    if (!clientName) return Response.json({ error: "Choose the client (plant)." }, { status: 400 });
    const client = await prisma.client.upsert({
      where: { name: clientName },
      create: { name: clientName },
      update: {},
    });
    clientId = client.id;
  }

  const site =
    user.role === "TECHNICIAN" ? user.site || "" : String(body.site || "").trim();
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

  // Notify supervisor (best-effort).
  const mail = await sendMail(reviewRequestEmail(report));

  return Response.json({ serial: report.serial, emailSent: mail.sent, emailReason: mail.reason });
}
