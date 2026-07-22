import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canView, canAct, canEdit } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { templateByCode } from "@/lib/templates";
import { rolesOf } from "@/lib/roles";

export async function GET(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }

  const report = await prisma.report.findUnique({
    where: { serial: params.serial },
    include: {
      photos: { orderBy: { order: "asc" } },
      trailEvents: { orderBy: { at: "asc" } },
    },
  });

  if (!report) return Response.json({ error: "Report not found." }, { status: 404 });
  if (!canView(report, user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  // Resolve the routed reviewers (by email) to names so the detail view can show
  // WHO must approve — even to viewers who can't act. There may be several
  // Equipment Users; any one of them can review.
  const supEmails = [...new Set([report.supervisorEmail, ...(report.supervisorEmails || [])].map((e) => String(e || "").trim().toLowerCase()).filter(Boolean))];
  const emails = [...supEmails, String(report.managerEmail || "").trim().toLowerCase()].filter(Boolean);
  const reviewerUsers = emails.length
    ? await prisma.user.findMany({ where: { email: { in: emails } }, select: { name: true, email: true } })
    : [];
  const nameFor = (e) => reviewerUsers.find((u) => u.email.toLowerCase() === String(e || "").toLowerCase())?.name || null;

  return Response.json({
    report,
    reviewers: {
      supervisorEmail: report.supervisorEmail,
      supervisorName: nameFor(report.supervisorEmail),
      // All Equipment Users the report is routed to.
      supervisors: supEmails.map((e) => ({ email: e, name: nameFor(e) })),
      managerEmail: report.managerEmail,
      managerName: nameFor(report.managerEmail),
    },
    permissions: {
      actAs: canAct(report, user), // "SUPERVISOR" | "MANAGER" | null
      canEdit: canEdit(report, user),
    },
  });
}

// PATCH /api/reports/[serial] — the author (before final approval) or an admin
// corrects a submitted report. The change is stamped on the trail with who and
// when; the report's approval stage is left unchanged.
export async function PATCH(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }

  const report = await prisma.report.findUnique({ where: { serial: params.serial } });
  if (!report) return Response.json({ error: "Report not found." }, { status: 404 });
  if (!canEdit(report, user)) return Response.json({ error: "You can't edit this report." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const tpl = templateByCode(report.template);

  const data = {
    values: body.values || {},
    checks: body.checks || {},
    grids: body.grids || {},
    runs: body.runs || {},
  };
  // Recompute the WB02 weekly verdict from the edited runs.
  if (report.template === "WB02") {
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

  const isTech = rolesOf(user).includes("TECHNICIAN") && !rolesOf(user).includes("ADMIN");
  const fields = { data };
  // Non-technicians may also correct the client/site/weighbridge and routing.
  if (!isTech) {
    if (body.clientName !== undefined) {
      const cn = String(body.clientName).trim();
      if (cn) {
        const c = await prisma.client.upsert({ where: { name: cn }, create: { name: cn }, update: {} });
        fields.clientId = c.id;
        fields.clientName = cn;
      }
    }
    if (body.site !== undefined) fields.site = String(body.site).trim() || null;
  }
  if (body.weighbridgeId !== undefined) fields.weighbridgeId = String(body.weighbridgeId).trim() || null;
  // Equipment User(s) — accept the array (or the legacy single) and keep the
  // primary in sync. Stored lower-cased for case-insensitive membership checks.
  const editSupers = [
    ...(Array.isArray(body.supervisorEmails) ? body.supervisorEmails : []),
    body.supervisorEmail,
  ].map((e) => String(e || "").trim()).filter(Boolean);
  if (editSupers.length) {
    const deduped = [...new Set(editSupers.map((e) => e.toLowerCase()))];
    fields.supervisorEmails = deduped;
    fields.supervisorEmail = deduped[0];
  }
  if (body.managerEmail !== undefined && String(body.managerEmail).trim())
    fields.managerEmail = String(body.managerEmail).trim();

  const photos = Array.isArray(body.photos) ? body.photos.slice(0, 8) : null;

  await prisma.report.update({
    where: { serial: params.serial },
    data: {
      ...fields,
      ...(photos
        ? {
            photos: {
              deleteMany: {},
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
          }
        : {}),
      trailEvents: {
        create: [{ action: "Edited", byName: user.name, byUserId: user.sub, comment: String(body.editNote || "").trim() || null }],
      },
    },
  });

  await recordAudit({
    actor: user,
    action: "UPDATE",
    entity: "REPORT",
    entityId: report.serial,
    summary: `Edited ${report.template} ${report.serial}`,
  });

  return Response.json({ ok: true });
}

// DELETE /api/reports/[serial] — permanently remove a report. Admin only (for
// clearing test records). Photos and trail events cascade; approval tokens are
// keyed by serial and removed explicitly.
export async function DELETE(_req, { params }) {
  let user;
  try {
    user = await requireUser(["ADMIN"]);
  } catch (res) {
    return res;
  }

  const report = await prisma.report.findUnique({ where: { serial: params.serial } });
  if (!report) return Response.json({ error: "Report not found." }, { status: 404 });

  await prisma.approvalToken.deleteMany({ where: { reportSerial: report.serial } });
  await prisma.report.delete({ where: { serial: report.serial } });

  await recordAudit({
    actor: user,
    action: "DELETE",
    entity: "REPORT",
    entityId: report.serial,
    summary: `Deleted ${report.template} ${report.serial} (${report.clientName})`,
  });

  return Response.json({ ok: true });
}
