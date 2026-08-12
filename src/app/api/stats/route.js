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

  // --- 14-day trend (scoped) — keyed to the service date so it matches the
  // management report. ---
  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);
  const recentForTrend = await prisma.report
    .findMany({ where: { AND: [where, { reportDate: { gte: since } }] }, select: { reportDate: true, createdAt: true } })
    .catch(() => []);
  const trendMap = {};
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    trendMap[d.toISOString().slice(0, 10)] = 0;
  }
  recentForTrend.forEach((r) => {
    const k = new Date(r.reportDate || r.createdAt).toISOString().slice(0, 10);
    if (k in trendMap) trendMap[k] += 1;
  });
  const reportsTrend = Object.entries(trendMap).map(([date, count]) => ({ date, count }));

  // --- 6-month volume (scoped) for the monthly bar chart ---
  let monthlyTrend = null;
  if (!client) {
    const monthStartFor = (offset) => {
      const dt = new Date();
      dt.setMonth(dt.getMonth() - offset, 1);
      dt.setHours(0, 0, 0, 0);
      return dt;
    };
    const sixAgo = monthStartFor(5);
    const monthRows = await prisma.report
      .findMany({ where: { AND: [where, { reportDate: { gte: sixAgo } }] }, select: { reportDate: true, createdAt: true } })
      .catch(() => []);
    const buckets = [];
    const idx = {};
    for (let i = 5; i >= 0; i--) {
      const dt = monthStartFor(i);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      idx[key] = buckets.length;
      buckets.push({ label: dt.toLocaleString("en-GB", { month: "short" }), count: 0 });
    }
    for (const r of monthRows) {
      const dt = new Date(r.reportDate || r.createdAt);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      if (key in idx) buckets[idx[key]].count += 1;
    }
    monthlyTrend = buckets;
  }

  // --- Headline quality + volume metrics (scoped) ---
  const approved = reportsByStatus.APPROVED || 0;
  const approvalRate = totalReports ? Math.round((approved / totalReports) * 100) : 0;
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6); weekAgo.setHours(0, 0, 0, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [reportsThisWeek, reportsThisMonth] = await Promise.all([
    prisma.report.count({ where: { AND: [where, { reportDate: { gte: weekAgo } }] } }).catch(() => 0),
    prisma.report.count({ where: { AND: [where, { reportDate: { gte: monthStart } }] } }).catch(() => 0),
  ]);

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

  // --- Active registered weighbridges (oversight) ---
  let activeWeighbridges = null;
  if (isOversight) {
    activeWeighbridges = await prisma.weighbridge.count({ where: { active: true } }).catch(() => 0);
  }

  // --- Admin-only: staff merits + business-at-a-glance ---
  let staffMerits = null;
  let business = null;
  let topClients = null;
  if (isAdmin) {
    try {
      // Merit board over the last 120 days, limited to QSL's own staff. A user
      // tied to a client is that client's staff, not a QSL merit candidate.
      const meritSince = new Date();
      meritSince.setDate(meritSince.getDate() - 120);
      const [mReports, staffUsers] = await Promise.all([
        prisma.report.findMany({
          where: { reportDate: { gte: meritSince } },
          select: { authorName: true, status: true, _count: { select: { photos: true } }, trailEvents: { select: { action: true, byName: true } } },
        }),
        prisma.user.findMany({ where: { clientId: null }, select: { name: true } }),
      ]);
      const internal = new Set(staffUsers.map((u) => u.name).filter(Boolean));
      const m = new Map();
      const ens = (n) => {
        const k = n || "—";
        if (!m.has(k)) m.set(k, { name: k, filed: 0, approved: 0, approvals: 0, rejections: 0, photos: 0 });
        return m.get(k);
      };
      for (const r of mReports) {
        const e = ens(r.authorName);
        e.filed += 1;
        if (r.status === "APPROVED") e.approved += 1;
        e.photos += r._count?.photos || 0;
        for (const ev of r.trailEvents || []) {
          const a = (ev.action || "").toLowerCase();
          if (a.includes("approved")) ens(ev.byName).approvals += 1;
          else if (a.includes("rejected")) ens(ev.byName).rejections += 1;
        }
      }
      staffMerits = [...m.values()]
        .filter((e) => internal.size === 0 || internal.has(e.name))
        .map((e) => ({ ...e, score: e.filed * 1 + e.approved * 2 + e.approvals * 2 + Math.round(e.photos * 0.2) - e.rejections }))
        .filter((e) => e.filed || e.approvals)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      const now = new Date();
      const [activeClients, activeSites, openTasks, overdueTasks, activeContracts, quotedAgg, acceptedAgg, clientGroups] = await Promise.all([
        prisma.client.count({ where: { active: true } }),
        prisma.site.count({ where: { active: true } }),
        prisma.task.count({ where: { doneAt: null } }),
        prisma.task.count({ where: { doneAt: null, dueAt: { lt: now } } }),
        prisma.contract.count({ where: { active: true } }),
        prisma.quotation.aggregate({ _sum: { grandTotal: true }, where: { status: "QUOTED" } }),
        prisma.quotation.aggregate({ _sum: { grandTotal: true }, where: { status: "ACCEPTED" } }),
        prisma.report.groupBy({ by: ["clientName"], _count: { _all: true } }),
      ]);
      business = {
        activeClients,
        activeSites,
        openTasks,
        overdueTasks,
        activeContracts,
        pipelineValue: Math.round(quotedAgg?._sum?.grandTotal || 0),
        wonValue: Math.round(acceptedAgg?._sum?.grandTotal || 0),
      };
      topClients = clientGroups
        .map((g) => ({ name: g.clientName || "—", count: g._count._all }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
    } catch {
      // best-effort — dashboard still renders without the admin extras.
    }
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
    monthlyTrend,
    approvalRate,
    reportsThisWeek,
    reportsThisMonth,
    activeWeighbridges,
    awaitingMe,
    quotations,
    calibrationRequests,
    satisfaction,
    schedulesDue,
    staffMerits,
    business,
    topClients,
    recent,
  });
}
