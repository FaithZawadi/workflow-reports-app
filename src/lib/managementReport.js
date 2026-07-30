import { prisma } from "./db";
import { reportScope, assignedClientIds } from "./rbac";
import { rolesOf } from "./roles";
import { templateByCode } from "./templates";

// The states for a checklist section: an explicit list, or the yes/no pair.
// The FIRST state is the "good" one; anything else is a flagged finding.
function statesOf(sec) {
  if (Array.isArray(sec?.states) && sec.states.length) return sec.states;
  return [
    { key: "ok", label: sec?.yes || "OK" },
    { key: "problem", label: sec?.no || "NEEDS ATTENTION" },
  ];
}

const STATUS_KEYS = ["PENDING_SUPERVISOR", "PENDING_MANAGER", "APPROVED", "REJECTED"];
const DAY = 86400000;

function dayStart(v) {
  const d = new Date(v);
  d.setHours(0, 0, 0, 0);
  return d;
}
function dayEnd(v) {
  const d = new Date(v);
  d.setHours(23, 59, 59, 999);
  return d;
}

// The immediately-preceding window of the same length, for period-over-period
// comparison. Returns null when the range is open-ended (no meaningful "before").
function previousWindow(from, to) {
  if (!from || !to) return null;
  const start = dayStart(from).getTime();
  const end = dayEnd(to).getTime();
  const span = end - start;
  const prevEnd = start - 1;
  const prevStart = prevEnd - span;
  return { from: new Date(prevStart), to: new Date(prevEnd) };
}

// A continuous time series of submissions across the range — daily buckets, or
// weekly when the span is long — so the trend chart always has sensible points.
// When a comparison window is supplied its counts ride alongside as `prev`.
function buildTrend(reports, from, to, prevReports) {
  if (!reports.length && !(prevReports && prevReports.length)) return [];
  const times = reports.map((r) => new Date(r.createdAt).getTime());
  const allTimes = times.length ? times : [Date.now()];
  const start = from ? dayStart(from).getTime() : Math.min(...allTimes);
  const end = to ? dayEnd(to).getTime() : Math.max(...allTimes);
  const spanDays = Math.max(1, Math.round((end - start) / DAY));
  const bucketMs = spanDays > 62 ? 7 * DAY : DAY;
  const n = Math.min(400, Math.floor((end - start) / bucketMs) + 1);

  const cur = new Map();
  for (const t of times) {
    const idx = Math.floor((t - start) / bucketMs);
    cur.set(idx, (cur.get(idx) || 0) + 1);
  }

  // Align previous-period buckets to the same bucket index (offset by the span).
  const prev = new Map();
  if (prevReports && prevReports.length) {
    const prevStart = start - (end - start) - 1;
    for (const r of prevReports) {
      const t = new Date(r.createdAt).getTime();
      const idx = Math.floor((t - prevStart) / bucketMs);
      prev.set(idx, (prev.get(idx) || 0) + 1);
    }
  }

  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      date: new Date(start + i * bucketMs).toISOString().slice(0, 10),
      count: cur.get(i) || 0,
      prev: prev.size ? prev.get(i) || 0 : undefined,
    });
  }
  return out;
}

// Core aggregation over a set of reports. Splits into the headline counters plus
// the segmented breakdowns and the checklist-level pass/fail tally.
function aggregate(reports) {
  const byStatus = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]));
  const wb = new Map(); // weighbridgeId -> { count, findings, label }
  const client = new Map(); // "client — site" -> count
  const tpl = new Map(); // template code -> { name, count }
  const author = new Map(); // authorName -> count
  const findings = [];
  const register = []; // one detailed row per report (the itemised service log)
  let turnaroundSum = 0;
  let turnaroundN = 0;
  let checkTotal = 0;
  let checkPassed = 0;
  let photosTotal = 0;
  const dayCounts = new Map(); // yyyy-mm-dd -> count (for "busiest day")

  for (const r of reports) {
    const findingsBefore = findings.length;
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;

    const dk = new Date(r.createdAt).toISOString().slice(0, 10);
    dayCounts.set(dk, (dayCounts.get(dk) || 0) + 1);

    const wbKey = r.weighbridgeId || "—";
    const wbe = wb.get(wbKey) || { count: 0, findings: 0, label: wbKey };
    wbe.count += 1;
    wb.set(wbKey, wbe);

    const clientKey = r.site ? `${r.clientName} — ${r.site}` : r.clientName || "—";
    client.set(clientKey, (client.get(clientKey) || 0) + 1);

    const te = tpl.get(r.template) || { name: r.templateName, count: 0 };
    te.count += 1;
    tpl.set(r.template, te);

    const aKey = r.authorName || "—";
    author.set(aKey, (author.get(aKey) || 0) + 1);

    let approverName = null;
    let turnaroundHours = null;
    if (r.status === "APPROVED" && r.trailEvents && r.trailEvents.length) {
      const last = r.trailEvents[r.trailEvents.length - 1];
      approverName = last.byName || null;
      const ms = new Date(last.at).getTime() - new Date(r.createdAt).getTime();
      if (ms > 0) {
        turnaroundHours = Number((ms / 3.6e6).toFixed(1));
        turnaroundSum += ms;
        turnaroundN += 1;
      }
    }
    const photos = r._count?.photos || 0;
    photosTotal += photos;

    const t = templateByCode(r.template);
    const sections = t?.sections || [];
    const checks = (r.data && r.data.checks) || {};
    for (const [key, v] of Object.entries(checks)) {
      if (!v || !v.state) continue;
      const [si, ii] = key.split(":").map(Number);
      const sec = sections[si];
      if (!sec || sec.type !== "checklist") continue;
      const states = statesOf(sec);
      checkTotal += 1;
      if (v.state === states[0].key) {
        checkPassed += 1;
        continue; // good — not a finding
      }
      const label = states.find((s) => s.key === v.state)?.label || v.state;
      findings.push({
        serial: r.serial,
        templateName: r.templateName,
        clientName: r.clientName,
        site: r.site || null,
        weighbridgeId: r.weighbridgeId || null,
        item: (sec.items && sec.items[ii]) || `Item ${ii + 1}`,
        result: label,
        remark: v.remark || "",
        createdAt: r.createdAt,
      });
      const wbe2 = wb.get(wbKey);
      if (wbe2) wbe2.findings += 1;
    }

    register.push({
      serial: r.serial,
      createdAt: r.createdAt,
      template: r.template,
      templateName: r.templateName,
      cadence: t?.cadence || "",
      weighbridgeId: r.weighbridgeId || null,
      clientName: r.clientName,
      site: r.site || null,
      authorName: r.authorName || "—",
      status: r.status,
      approverName,
      turnaroundHours,
      findings: findings.length - findingsBefore,
      photos,
      outcome: (r.data && r.data.values && r.data.values.outcome) || null,
    });
  }

  const total = reports.length;
  const approved = byStatus.APPROVED || 0;
  const rejected = byStatus.REJECTED || 0;
  const pending = (byStatus.PENDING_SUPERVISOR || 0) + (byStatus.PENDING_MANAGER || 0);

  return {
    total, byStatus, approved, rejected, pending,
    wb, client, tpl, author, findings, register, photosTotal,
    turnaroundSum, turnaroundN, checkTotal, checkPassed, dayCounts,
    approvalRate: total ? Math.round((approved / total) * 100) : 0,
    rejectionRate: total ? Math.round((rejected / total) * 100) : 0,
    findingsRate: total ? Number((findings.length / total).toFixed(2)) : 0,
    avgTurnaroundHours: turnaroundN ? Number((turnaroundSum / turnaroundN / 3.6e6).toFixed(1)) : null,
  };
}

function whereFor(user, from, to, client) {
  const where = { ...reportScope(user) };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from instanceof Date ? from : dayStart(from);
    if (to) where.createdAt.lte = to instanceof Date ? to : dayEnd(to);
  }
  if (client) where.clientId = client;
  return where;
}

// Build a period-over-period delta for a metric. `dir` says which direction is
// "good" so the UI can colour it (higher approvals good, higher rejects bad).
function delta(cur, prev, { dir = "up", unit = "" } = {}) {
  if (prev == null) return null;
  const diff = Number((cur - prev).toFixed(2));
  const good = dir === "up" ? diff > 0 : diff < 0;
  const trend = diff === 0 ? "flat" : good ? "good" : "bad";
  return { prev, diff, abs: Math.abs(diff), trend, unit };
}

function buildInsights(cur, prev, ranked) {
  const out = [];
  if (cur.total === 0) {
    out.push({ kind: "trend", title: "No activity", body: "No reports were filed in this period." });
    return out;
  }
  // What's working — approvals.
  const apDelta = prev ? cur.approvalRate - prev.approvalRate : null;
  out.push({
    kind: "good",
    title: "What's working",
    body:
      apDelta != null && apDelta > 0
        ? `Approvals are up ${apDelta} points — ${cur.approvalRate}% of reports cleared this period.`
        : `${cur.approvalRate}% of reports were approved (${cur.approved} of ${cur.total}).`,
  });
  // Needs attention — worst weighbridge for findings, else rejection movement.
  const worstWb = ranked.byWeighbridge.filter((w) => w.findings > 0).sort((a, b) => b.findings - a.findings)[0];
  if (worstWb) {
    const topItem = ranked.topFindings[0]?.item;
    out.push({
      kind: "bad",
      title: "Needs attention",
      body: `${worstWb.label} logged the most findings (${worstWb.findings})${topItem ? ` — mostly ${topItem.toLowerCase()}` : ""}.`,
    });
  } else if (cur.findingsCount > 0) {
    out.push({ kind: "bad", title: "Needs attention", body: `${cur.findingsCount} checklist item${cur.findingsCount === 1 ? "" : "s"} flagged across the period.` });
  } else {
    out.push({ kind: "good", title: "Clean sheet", body: "No checklist items were flagged in this period. 🎉" });
  }
  // Trend — busiest day + volume movement.
  let busiest = null;
  for (const [d, c] of cur.dayCounts) if (!busiest || c > busiest.c) busiest = { d, c };
  const volDelta = prev ? cur.total - prev.total : null;
  const volPart = volDelta != null ? ` Volume ${volDelta >= 0 ? "up" : "down"} ${Math.abs(volDelta)} vs previous period.` : "";
  out.push({
    kind: "trend",
    title: "Trend",
    body: busiest ? `Busiest day was ${busiest.d} with ${busiest.c} submission${busiest.c === 1 ? "" : "s"}.${volPart}` : `${cur.total} reports filed.${volPart}`,
  });
  return out;
}

const now = () => Date.now();
const DAYS = (n) => n * DAY;

// A compact status tally { KEY: count, total }.
function tally(rows, key) {
  const out = { total: rows.length };
  for (const r of rows) {
    const k = r[key] || "UNKNOWN";
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

// The wider operational picture beyond service reports — calibration requests,
// the quotation pipeline (with value), customer & training satisfaction, task
// workload, and overdue maintenance / upcoming service contracts. Admins and the
// two report-generating managers see everything; other generators (supervisor /
// manager) are scoped to the clients whose weighbridges they are assigned to.
// Every source is guarded so a gap in one never breaks the whole report.
async function buildOperations(user, from, to, clientFilter) {
  const roles = rolesOf(user);
  const isAll = roles.includes("ADMIN") || roles.includes("PROJECT_MANAGER") || roles.includes("TECHNICAL_MANAGER");

  let clientIds = null;
  if (!isAll) {
    clientIds = await assignedClientIds(user);
    if (!clientIds.length) clientIds = ["__no_match__"]; // scoped user with no clients → empty
  }
  // A specific client selected in the report narrows every source to that client.
  if (clientFilter) clientIds = clientIds ? clientIds.filter((id) => id === clientFilter) : [clientFilter];
  const byClient = clientIds ? { clientId: { in: clientIds } } : {};

  const created = {};
  if (from) created.gte = dayStart(from);
  if (to) created.lte = dayEnd(to);
  const dateWhere = from || to ? { createdAt: created } : {};
  const t = now();

  const safe = async (fn, fallback) => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  // ---- Calibration requests (CRF) ----
  const crf = await safe(async () => {
    const rows = await prisma.calibrationRequest.findMany({
      where: { ...byClient, ...dateWhere },
      select: { status: true, calibrationType: true, serial: true, clientName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const st = tally(rows, "status");
    return {
      total: rows.length,
      submitted: st.SUBMITTED || 0,
      accepted: st.ACCEPTED || 0,
      rejected: st.REJECTED || 0,
      inSitu: rows.filter((r) => r.calibrationType === "IN_SITU").length,
      lab: rows.filter((r) => r.calibrationType === "LAB").length,
      recent: rows.slice(0, 5).map((r) => ({ serial: r.serial, clientName: r.clientName, status: r.status, createdAt: r.createdAt })),
    };
  }, null);

  // ---- Quotation pipeline (with value) ----
  const quotes = await safe(async () => {
    const rows = await prisma.quotation.findMany({
      where: { ...byClient, ...dateWhere },
      select: { status: true, grandTotal: true, currency: true },
    });
    const st = tally(rows, "status");
    const requested = st.REQUESTED || 0;
    const quoted = st.QUOTED || 0;
    const accepted = st.ACCEPTED || 0;
    const declined = st.DECLINED || 0;
    const decided = accepted + declined;
    const cur = {};
    for (const r of rows) cur[r.currency || "KES"] = (cur[r.currency || "KES"] || 0) + 1;
    const currency = Object.entries(cur).sort((a, b) => b[1] - a[1])[0]?.[0] || "KES";
    const sumWhere = (fn) => rows.filter(fn).reduce((a, r) => a + (r.grandTotal || 0), 0);
    return {
      total: rows.length,
      requested, quoted, accepted, declined,
      currency,
      pipelineValue: Math.round(sumWhere((r) => r.status === "QUOTED" || r.status === "ACCEPTED")),
      wonValue: Math.round(sumWhere((r) => r.status === "ACCEPTED")),
      winRate: decided ? Math.round((accepted / decided) * 100) : null,
    };
  }, null);

  // ---- Task workload (current state) ----
  const tasks = await safe(async () => {
    const rows = await prisma.task.findMany({
      where: clientIds ? { clientId: { in: clientIds } } : {},
      select: { status: true, dueAt: true, doneAt: true, priority: true, createdAt: true, title: true, assignedName: true },
    });
    const st = tally(rows, "status");
    const open = (st.OPEN || 0) + (st.IN_PROGRESS || 0) + (st.BLOCKED || 0);
    const overdueRows = rows.filter((r) => r.status !== "DONE" && r.dueAt && new Date(r.dueAt).getTime() < t);
    const filedInPeriod = rows.filter((r) => {
      const c = new Date(r.createdAt).getTime();
      return (!from || c >= dayStart(from).getTime()) && (!to || c <= dayEnd(to).getTime());
    }).length;
    return {
      total: rows.length,
      open,
      done: st.DONE || 0,
      blocked: st.BLOCKED || 0,
      inProgress: st.IN_PROGRESS || 0,
      openNew: st.OPEN || 0,
      overdue: overdueRows.length,
      highPriorityOpen: rows.filter((r) => r.status !== "DONE" && r.priority === "HIGH").length,
      filedInPeriod,
      overdueList: overdueRows
        .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
        .slice(0, 5)
        .map((r) => ({ title: r.title, assignedName: r.assignedName || "—", dueAt: r.dueAt })),
    };
  }, null);

  // ---- Overdue maintenance obligations (schedules, as of today) ----
  const schedules = await safe(async () => {
    const rows = await prisma.schedule.findMany({
      where: { active: true, ...(clientIds ? { clientId: { in: clientIds } } : {}) },
      select: { nextDueAt: true, templateName: true, clientName: true, weighbridgeId: true },
    });
    const overdue = rows.filter((r) => new Date(r.nextDueAt).getTime() < t);
    const dueSoon = rows.filter((r) => {
      const d = new Date(r.nextDueAt).getTime();
      return d >= t && d < t + DAYS(7);
    });
    return {
      active: rows.length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      overdueList: overdue
        .sort((a, b) => new Date(a.nextDueAt) - new Date(b.nextDueAt))
        .slice(0, 5)
        .map((r) => ({ label: `${r.templateName} · ${r.clientName}`, weighbridgeId: r.weighbridgeId || "—", dueAt: r.nextDueAt })),
    };
  }, null);

  // ---- Service contracts (upcoming / overdue, as of today) ----
  const contracts = await safe(async () => {
    const rows = await prisma.contract.findMany({
      where: { active: true, ...(clientIds ? { clientId: { in: clientIds } } : {}) },
      select: { nextServiceAt: true, clientName: true, name: true },
    });
    const overdue = rows.filter((r) => new Date(r.nextServiceAt).getTime() < t);
    const dueSoon = rows.filter((r) => {
      const d = new Date(r.nextServiceAt).getTime();
      return d >= t && d < t + DAYS(30);
    });
    return {
      active: rows.length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      upcomingList: [...overdue, ...dueSoon]
        .sort((a, b) => new Date(a.nextServiceAt) - new Date(b.nextServiceAt))
        .slice(0, 5)
        .map((r) => ({ label: `${r.name} · ${r.clientName}`, dueAt: r.nextServiceAt, overdue: new Date(r.nextServiceAt).getTime() < t })),
    };
  }, null);

  // ---- Active weighbridge fleet ----
  const fleet = await safe(
    () => prisma.weighbridge.count({ where: { active: true, ...(clientIds ? { clientId: { in: clientIds } } : {}) } }),
    null
  );

  // ---- Customer & training satisfaction (all-viewers only) ----
  let satisfaction = null;
  let training = null;
  if (isAll) {
    satisfaction = await safe(async () => {
      const rows = await prisma.serviceFeedback.findMany({ where: dateWhere, select: { overall: true, rating: true, recommend: true } });
      const scores = rows.map((r) => r.overall ?? r.rating).filter((v) => typeof v === "number");
      const avg = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : null;
      const withRec = rows.filter((r) => r.recommend).length;
      const recYes = rows.filter((r) => r.recommend === "YES").length;
      return { count: rows.length, avg, recommendRate: withRec ? Math.round((recYes / withRec) * 100) : null };
    }, null);
    training = await safe(async () => {
      const rows = await prisma.trainingFeedback.findMany({ where: dateWhere, select: { overall: true, recommend: true } });
      const scores = rows.map((r) => r.overall).filter((v) => typeof v === "number");
      const avg = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : null;
      return { count: rows.length, avg };
    }, null);
  }

  return { scope: isAll ? "all" : "assigned", crf, quotes, tasks, schedules, contracts, fleet, satisfaction, training };
}

// The deeper, per-dimension report tabs — staff productivity, weighbridge
// (equipment) history, client account statements and compliance/adherence — all
// derived from the reports already loaded plus the operations snapshot.
function buildDimensions(reports, cur, operations) {
  const staff = new Map();
  const wbh = new Map();
  const clients = new Map();

  const ensureStaff = (name) => {
    const k = name || "—";
    if (!staff.has(k)) staff.set(k, { name: k, filed: 0, approvals: 0, rejections: 0, findings: 0, photos: 0, tSum: 0, tN: 0 });
    return staff.get(k);
  };

  for (const r of cur.register) {
    const sf = ensureStaff(r.authorName);
    sf.filed += 1;
    sf.findings += r.findings || 0;
    sf.photos += r.photos || 0;
    if (r.turnaroundHours != null) { sf.tSum += r.turnaroundHours; sf.tN += 1; }

    const wid = r.weighbridgeId || "—";
    const w = wbh.get(wid) || { id: wid, clientName: r.clientName, site: r.site, reports: 0, findings: 0, photos: 0, approved: 0, pending: 0, rejected: 0, byType: new Map(), lastDate: null };
    w.reports += 1; w.findings += r.findings || 0; w.photos += r.photos || 0;
    if (r.status === "APPROVED") w.approved += 1; else if (r.status === "REJECTED") w.rejected += 1; else w.pending += 1;
    w.byType.set(r.templateName, (w.byType.get(r.templateName) || 0) + 1);
    if (!w.lastDate || new Date(r.createdAt) > new Date(w.lastDate)) w.lastDate = r.createdAt;
    wbh.set(wid, w);

    const cname = r.clientName || "—";
    const c = clients.get(cname) || { name: cname, reports: 0, findings: 0, approved: 0, pending: 0, rejected: 0, photos: 0, byType: new Map(), sites: new Set(), weighbridges: new Set(), lastDate: null };
    c.reports += 1; c.findings += r.findings || 0; c.photos += r.photos || 0;
    if (r.status === "APPROVED") c.approved += 1; else if (r.status === "REJECTED") c.rejected += 1; else c.pending += 1;
    c.byType.set(r.templateName, (c.byType.get(r.templateName) || 0) + 1);
    if (r.site) c.sites.add(r.site);
    if (r.weighbridgeId) c.weighbridges.add(r.weighbridgeId);
    if (!c.lastDate || new Date(r.createdAt) > new Date(c.lastDate)) c.lastDate = r.createdAt;
    clients.set(cname, c);
  }

  // Reviews / approvals given — who signed reports off, from the trail.
  for (const r of reports) {
    for (const ev of r.trailEvents || []) {
      const a = (ev.action || "").toLowerCase();
      if (a.includes("approved")) ensureStaff(ev.byName).approvals += 1;
      else if (a.includes("rejected")) ensureStaff(ev.byName).rejections += 1;
    }
  }

  const staffArr = [...staff.values()]
    .map((s) => ({ name: s.name, filed: s.filed, approvals: s.approvals, rejections: s.rejections, findings: s.findings, photos: s.photos, avgTurnaround: s.tN ? Number((s.tSum / s.tN).toFixed(1)) : null }))
    .sort((a, b) => b.filed + b.approvals - (a.filed + a.approvals));

  const svc = (m) => [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const weighbridgeHistory = [...wbh.values()]
    .map((w) => ({ id: w.id, clientName: w.clientName, site: w.site, reports: w.reports, findings: w.findings, photos: w.photos, approved: w.approved, pending: w.pending, rejected: w.rejected, lastDate: w.lastDate, services: svc(w.byType) }))
    .sort((a, b) => b.reports - a.reports);
  const clientsArr = [...clients.values()]
    .map((c) => ({ name: c.name, reports: c.reports, findings: c.findings, approved: c.approved, pending: c.pending, rejected: c.rejected, photos: c.photos, sites: c.sites.size, weighbridges: c.weighbridges.size, lastDate: c.lastDate, services: svc(c.byType) }))
    .sort((a, b) => b.reports - a.reports);

  const sch = operations?.schedules;
  const con = operations?.contracts;
  const scheduleAdherence = sch && sch.active ? Math.round(((sch.active - sch.overdue) / sch.active) * 100) : null;
  const compliance = {
    checklistPassRate: cur.checkTotal ? Math.round((cur.checkPassed / cur.checkTotal) * 100) : null,
    checklistItems: cur.checkTotal,
    checklistPassed: cur.checkPassed,
    approvalRate: cur.total ? Math.round((cur.approved / cur.total) * 100) : 0,
    rejectionRate: cur.rejectionRate,
    avgTurnaroundHours: cur.avgTurnaroundHours,
    reportsApproved: cur.approved,
    reportsRejected: cur.rejected,
    reportsPending: cur.pending,
    findingsOpen: cur.findingsCount,
    schedulesActive: sch?.active ?? null,
    schedulesOverdue: sch?.overdue ?? null,
    schedulesDueSoon: sch?.dueSoon ?? null,
    scheduleAdherence,
    scheduleOverdueList: sch?.overdueList || [],
    contractsOverdue: con?.overdue ?? null,
    contractsDueSoon: con?.dueSoon ?? null,
    contractUpcomingList: con?.upcomingList || [],
  };

  return { staff: staffArr, weighbridgeHistory, clients: clientsArr, compliance };
}

// Build the role-scoped management report for a date range. Returns a plain
// object with the summary, every segmented breakdown, period-over-period deltas,
// auto insights and the flagged findings. Reused by the JSON API and the PDF.
export async function buildManagementReport(user, { from, to, client } = {}) {
  const reports = await prisma.report.findMany({
    where: whereFor(user, from, to, client),
    orderBy: { createdAt: "desc" },
    include: { trailEvents: { orderBy: { at: "asc" } }, _count: { select: { photos: true } } },
  });

  const prevWin = previousWindow(from, to);
  let prevReports = [];
  if (prevWin) {
    prevReports = await prisma.report.findMany({
      where: whereFor(user, prevWin.from, prevWin.to, client),
      orderBy: { createdAt: "desc" },
      include: { trailEvents: { orderBy: { at: "asc" } }, _count: { select: { photos: true } } },
    });
  }

  // The list of clients this user can report on — powers the client filter.
  const clientOptions = await prisma.report
    .findMany({
      where: reportScope(user),
      distinct: ["clientId"],
      select: { clientId: true, clientName: true },
      orderBy: { clientName: "asc" },
    })
    .then((rows) => rows.filter((r) => r.clientId).map((r) => ({ id: r.clientId, name: r.clientName })))
    .catch(() => []);
  const clientLabel = client ? clientOptions.find((c) => c.id === client)?.name || null : null;

  const cur = aggregate(reports);
  const prev = prevWin ? aggregate(prevReports) : null;
  cur.findingsCount = cur.findings.length;
  if (prev) prev.findingsCount = prev.findings.length;

  const desc = (a, b) => b.count - a.count;

  const findingCounts = new Map();
  for (const f of cur.findings) findingCounts.set(f.item, (findingCounts.get(f.item) || 0) + 1);
  const topFindings = [...findingCounts.entries()].map(([item, count]) => ({ item, count })).sort(desc).slice(0, 8);

  const byWeighbridge = [...cur.wb.values()].map((v) => ({ id: v.label, label: v.label, count: v.count, findings: v.findings })).sort(desc);
  const byClient = [...cur.client.entries()].map(([name, count]) => ({ name, count })).sort(desc);
  const byTemplate = [...cur.tpl.entries()].map(([code, v]) => ({ code, name: v.name, count: v.count })).sort(desc);
  const byAuthor = [...cur.author.entries()].map(([name, count]) => ({ name, count })).sort(desc);

  const passRate = cur.checkTotal ? Math.round((cur.checkPassed / cur.checkTotal) * 100) : null;

  const deltas = {
    total: delta(cur.total, prev?.total ?? null, { dir: "up" }),
    approvalRate: delta(cur.approvalRate, prev?.approvalRate ?? null, { dir: "up", unit: "pts" }),
    rejectionRate: delta(cur.rejectionRate, prev?.rejectionRate ?? null, { dir: "down", unit: "pts" }),
    findingsCount: delta(cur.findingsCount, prev?.findingsCount ?? null, { dir: "down" }),
    avgTurnaroundHours:
      cur.avgTurnaroundHours != null && prev?.avgTurnaroundHours != null
        ? delta(cur.avgTurnaroundHours, prev.avgTurnaroundHours, { dir: "down", unit: "h" })
        : null,
  };

  const operations = await buildOperations(user, from, to, client || null);
  const dimensions = buildDimensions(reports, cur, operations);

  // Services delivered by type — the itemised "what was done" for the period.
  const servicesDelivered = byTemplate.map((t) => ({ code: t.code, name: t.name, count: t.count }));

  // Platform-usage / ease-of-work metrics — everything the app captured.
  const usage = {
    reports: cur.total,
    servicesDelivered: cur.total,
    checklistItems: cur.checkTotal,
    photos: cur.photosTotal,
    findingsRaised: cur.findingsCount,
    approvals: cur.approved,
    weighbridgesServiced: byWeighbridge.length,
    sitesServiced: byClient.length,
    staffActive: byAuthor.length,
    avgPhotosPerReport: cur.total ? Number((cur.photosTotal / cur.total).toFixed(1)) : 0,
    avgTurnaroundHours: cur.avgTurnaroundHours,
    calibrationRequests: operations?.crf?.total ?? null,
    quotations: operations?.quotes?.total ?? null,
    tasksHandled: operations?.tasks?.total ?? null,
    trainingSessions: operations?.training?.count ?? null,
  };

  const insights = buildInsights(cur, prev, { byWeighbridge, topFindings });
  // Fold the most pressing operational risk into the insight strip.
  const ops = operations || {};
  const overdueMaint = ops.schedules?.overdue || 0;
  const overdueTasks = ops.tasks?.overdue || 0;
  if (overdueMaint > 0) {
    insights.push({ kind: "bad", title: "Overdue maintenance", body: `${overdueMaint} scheduled maintenance obligation${overdueMaint === 1 ? " is" : "s are"} past due — plus ${ops.schedules?.dueSoon || 0} due within 7 days.` });
  } else if (overdueTasks > 0) {
    insights.push({ kind: "bad", title: "Overdue tasks", body: `${overdueTasks} assigned task${overdueTasks === 1 ? " is" : "s are"} past their due date.` });
  }
  if (ops.quotes && (ops.quotes.pipelineValue || 0) > 0) {
    insights.push({ kind: "trend", title: "Sales pipeline", body: `${ops.quotes.currency} ${ops.quotes.pipelineValue.toLocaleString()} in open quotations${ops.quotes.winRate != null ? ` · ${ops.quotes.winRate}% win rate` : ""}.` });
  }

  return {
    operations,
    range: { from: from || null, to: to || null },
    compareRange: prevWin ? { from: prevWin.from.toISOString().slice(0, 10), to: prevWin.to.toISOString().slice(0, 10) } : null,
    generatedAt: new Date().toISOString(),
    total: cur.total,
    byStatus: cur.byStatus,
    pending: cur.pending,
    approved: cur.approved,
    rejected: cur.rejected,
    approvalRate: cur.approvalRate,
    rejectionRate: cur.rejectionRate,
    findingsRate: cur.findingsRate,
    avgTurnaroundHours: cur.avgTurnaroundHours,
    checklistTotal: cur.checkTotal,
    checklistPassed: cur.checkPassed,
    passRate,
    deltas,
    insights,
    trend: buildTrend(reports, from, to, prevReports),
    byWeighbridge,
    byClient,
    byTemplate,
    byAuthor,
    topFindings,
    findings: cur.findings,
    findingsCount: cur.findingsCount,
    register: cur.register,
    servicesDelivered,
    usage,
    clientOptions,
    client: client || null,
    clientLabel,
    staff: dimensions.staff,
    weighbridgeHistory: dimensions.weighbridgeHistory,
    clients: dimensions.clients,
    compliance: dimensions.compliance,
  };
}
