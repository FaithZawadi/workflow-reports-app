import { prisma } from "./db";
import { reportScope } from "./rbac";
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

// A continuous time series of submissions across the range — daily buckets, or
// weekly when the span is long — so the trend chart always has sensible points.
function buildTrend(reports, from, to) {
  if (!reports.length) return [];
  const times = reports.map((r) => new Date(r.createdAt).getTime());
  const start = from ? new Date(from).getTime() : Math.min(...times);
  const end = to ? new Date(to + "T23:59:59").getTime() : Math.max(...times);
  const dayMs = 86400000;
  const spanDays = Math.max(1, Math.round((end - start) / dayMs));
  const bucketMs = spanDays > 62 ? 7 * dayMs : dayMs;
  const buckets = new Map();
  for (const t of times) {
    const idx = Math.floor((t - start) / bucketMs);
    buckets.set(idx, (buckets.get(idx) || 0) + 1);
  }
  const n = Math.min(400, Math.floor((end - start) / bucketMs) + 1);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ date: new Date(start + i * bucketMs).toISOString().slice(0, 10), count: buckets.get(i) || 0 });
  }
  return out;
}

// Build the role-scoped management report for a date range. Returns a plain
// object with the summary and every segmented breakdown, plus the flagged
// findings. Reused by both the JSON API (on-screen) and the PDF.
export async function buildManagementReport(user, { from, to } = {}) {
  const where = { ...reportScope(user) };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const reports = await prisma.report.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { trailEvents: { orderBy: { at: "asc" } } },
  });

  const byStatus = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]));
  const wb = new Map(); // weighbridgeId -> { count, findings }
  const client = new Map(); // "client — site" -> count
  const tpl = new Map(); // template code -> { name, count }
  const author = new Map(); // authorName -> count
  const findings = [];
  let turnaroundSum = 0;
  let turnaroundN = 0;

  for (const r of reports) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;

    const wbKey = r.weighbridgeId || "—";
    const wbe = wb.get(wbKey) || { count: 0, findings: 0 };
    wbe.count += 1;
    wb.set(wbKey, wbe);

    const clientKey = r.site ? `${r.clientName} — ${r.site}` : r.clientName || "—";
    client.set(clientKey, (client.get(clientKey) || 0) + 1);

    const te = tpl.get(r.template) || { name: r.templateName, count: 0 };
    te.count += 1;
    tpl.set(r.template, te);

    const aKey = r.authorName || "—";
    author.set(aKey, (author.get(aKey) || 0) + 1);

    // Approval turnaround: time from submission to the final (last) trail event
    // on an approved report.
    if (r.status === "APPROVED" && r.trailEvents.length) {
      const last = r.trailEvents[r.trailEvents.length - 1];
      const ms = new Date(last.at).getTime() - new Date(r.createdAt).getTime();
      if (ms > 0) {
        turnaroundSum += ms;
        turnaroundN += 1;
      }
    }

    // Flagged findings: any checklist result that isn't the "good" first state.
    const t = templateByCode(r.template);
    const sections = t?.sections || [];
    const checks = (r.data && r.data.checks) || {};
    for (const [key, v] of Object.entries(checks)) {
      if (!v || !v.state) continue;
      const [si, ii] = key.split(":").map(Number);
      const sec = sections[si];
      if (!sec || sec.type !== "checklist") continue;
      const states = statesOf(sec);
      if (v.state === states[0].key) continue; // good — not a finding
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
  }

  const desc = (a, b) => b.count - a.count;

  // Most-common flagged items across the period.
  const findingCounts = new Map();
  for (const f of findings) findingCounts.set(f.item, (findingCounts.get(f.item) || 0) + 1);
  const topFindings = [...findingCounts.entries()].map(([item, count]) => ({ item, count })).sort(desc).slice(0, 8);

  const total = reports.length;
  const approved = byStatus.APPROVED || 0;
  const rejected = byStatus.REJECTED || 0;
  const pending = (byStatus.PENDING_SUPERVISOR || 0) + (byStatus.PENDING_MANAGER || 0);

  return {
    range: { from: from || null, to: to || null },
    generatedAt: new Date().toISOString(),
    total,
    byStatus,
    pending,
    approved,
    rejected,
    approvalRate: total ? Math.round((approved / total) * 100) : 0,
    rejectionRate: total ? Math.round((rejected / total) * 100) : 0,
    findingsRate: total ? Number((findings.length / total).toFixed(2)) : 0,
    avgTurnaroundHours: turnaroundN ? Number((turnaroundSum / turnaroundN / 3.6e6).toFixed(1)) : null,
    trend: buildTrend(reports, from, to),
    byWeighbridge: [...wb.entries()].map(([id, v]) => ({ id, count: v.count, findings: v.findings })).sort(desc),
    byClient: [...client.entries()].map(([name, count]) => ({ name, count })).sort(desc),
    byTemplate: [...tpl.entries()].map(([code, v]) => ({ code, name: v.name, count: v.count })).sort(desc),
    byAuthor: [...author.entries()].map(([name, count]) => ({ name, count })).sort(desc),
    topFindings,
    findings,
    findingsCount: findings.length,
  };
}
