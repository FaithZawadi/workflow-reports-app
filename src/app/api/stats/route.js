import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { reportScope } from "@/lib/rbac";
import { rolesOf, canPrepareQuotes, isClient } from "@/lib/roles";
import { templateByCode } from "@/lib/templates";

export const dynamic = "force-dynamic";

const norm = (v) => (v || "").trim().toLowerCase();

// GET /api/stats — role-scoped dashboard metrics. Everything is limited to what
// the signed-in user may see, so the dashboard shows different content per role.
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }

  const roles = rolesOf(user);
  const isAdmin = roles.includes("ADMIN");
  const isOversight = isAdmin || canPrepareQuotes(user); // PM / TM / admin
  const client = isClient(user);
  const where = reportScope(user); // reports this user may see (empty {} = all)

  // --- Reports by status + template (scoped) ---
  const [byStatus, byTemplate] = await Promise.all([
    prisma.report.groupBy({ by: ["status"], where, _count: { _all: true } }).catch(() => []),
    prisma.report.groupBy({ by: ["template"], where, _count: { _all: true } }).catch(() => []),
  ]);
  const reportsByStatus = { PENDING_SUPERVISOR: 0, PENDING_MANAGER: 0, APPROVED: 0, REJECTED: 0 };
  byStatus.forEach((r) => (reportsByStatus[r.status] = r._count._all));
  const reportsByTemplate = byTemplate
    .map((r) => ({ code: r.template, name: templateByCode(r.template)?.name || r.template, count: r._count._all }))
    .sort((a, b) => b.count - a.count);
  const totalReports = Object.values(reportsByStatus).reduce((a, b) => a + b, 0);

  // --- 14-day trend (scoped) ---
  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);
  const recentForTrend = await prisma.report
    .findMany({ where: { AND: [where, { createdAt: { gte: since } }] }, select: { createdAt: true } })
    .catch(() => []);
  const trendMap = {};
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    trendMap[d.toISOString().slice(0, 10)] = 0;
  }
  recentForTrend.forEach((r) => {
    const k = new Date(r.createdAt).toISOString().slice(0, 10);
    if (k in trendMap) trendMap[k] += 1;
  });
  const reportsTrend = Object.entries(trendMap).map(([date, count]) => ({ date, count }));

  // --- Awaiting me (supervisor/manager routing) ---
  const email = norm(user.email);
  let awaitingMe = 0;
  if (email) {
    awaitingMe = await prisma.report
      .count({
        where: {
          OR: [
            { status: "PENDING_SUPERVISOR", supervisorEmail: { equals: user.email, mode: "insensitive" } },
            { status: "PENDING_MANAGER", managerEmail: { equals: user.email, mode: "insensitive" } },
          ],
        },
      })
      .catch(() => 0);
  }

  // --- Quotations + calibration requests (PM/TM/admin see all; clients see own) ---
  let quotations = null;
  let calibrationRequests = null;
  if (isOversight || client) {
    const qWhere = client ? (user.clientId ? { clientId: user.clientId } : { requestedById: user.sub }) : {};
    const crWhere = qWhere;
    const [qs, crs] = await Promise.all([
      prisma.quotation.groupBy({ by: ["status"], where: qWhere, _count: { _all: true } }).catch(() => []),
      prisma.calibrationRequest.groupBy({ by: ["status"], where: crWhere, _count: { _all: true } }).catch(() => []),
    ]);
    quotations = { REQUESTED: 0, QUOTED: 0, ACCEPTED: 0, DECLINED: 0 };
    qs.forEach((r) => (quotations[r.status] = r._count._all));
    calibrationRequests = { SUBMITTED: 0, ACCEPTED: 0, REJECTED: 0 };
    crs.forEach((r) => (calibrationRequests[r.status] = r._count._all));
  }

  // --- Customer satisfaction + schedules due (oversight only) ---
  let satisfaction = null;
  let schedulesDue = null;
  if (isOversight) {
    const agg = await prisma.serviceFeedback.aggregate({ _avg: { overall: true }, _count: { overall: true } }).catch(() => null);
    satisfaction = { average: agg?._avg?.overall ? Math.round(agg._avg.overall * 10) / 10 : 0, count: agg?._count?.overall || 0 };
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    schedulesDue = await prisma.schedule.count({ where: { active: true, nextDueAt: { lte: in7 } } }).catch(() => 0);
  }

  // --- Recent activity (scoped reports) ---
  const recentReports = await prisma.report
    .findMany({ where, orderBy: { createdAt: "desc" }, take: 6, select: { serial: true, template: true, templateName: true, status: true, clientName: true, createdAt: true } })
    .catch(() => []);
  const recent = recentReports.map((r) => ({
    serial: r.serial,
    title: r.templateName,
    subtitle: r.clientName,
    status: r.status,
    at: r.createdAt,
    link: `/reports/${r.serial}`,
  }));

  return Response.json({
    role: user.role,
    name: user.name,
    isOversight,
    isClient: client,
    totalReports,
    reportsByStatus,
    reportsByTemplate,
    reportsTrend,
    awaitingMe,
    quotations,
    calibrationRequests,
    satisfaction,
    schedulesDue,
    recent,
  });
}
