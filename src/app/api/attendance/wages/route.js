import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageAttendance } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The calendar day (Africa/Nairobi) a clock event falls on, as YYYY-MM-DD.
const dayOf = (at) => new Date(at).toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

// GET /api/attendance/wages?from=YYYY-MM-DD&to=YYYY-MM-DD&site=...  ?format=csv
// The daily-wages report: one row per worker per day they were present (had any
// clock event that day), earning that worker's current daily wage. Lets a
// manager see what each worker is owed for each day worked.
export async function GET(req) {
  try {
    const user = await requireUser();
    if (!canManageAttendance(user)) return Response.json({ error: "Only a manager can view wages." }, { status: 403 });
  } catch (res) {
    return res;
  }

  const sp = new URL(req.url).searchParams;
  const csv = sp.get("format") === "csv";
  const where = {};
  const site = sp.get("site");
  if (site) where.site = site;
  const from = sp.get("from");
  const to = sp.get("to");
  if (from || to) {
    where.at = {};
    if (from) where.at.gte = new Date(from + "T00:00:00");
    if (to) where.at.lte = new Date(to + "T23:59:59.999");
  }

  const events = await prisma.clockEvent.findMany({
    where,
    orderBy: { at: "asc" },
    take: 20000,
    select: { workerId: true, site: true, at: true, worker: { select: { name: true, jobTitle: true, dailyWage: true } } },
  });

  // Collapse to one entry per worker per day (the first site seen that day).
  const seen = new Map(); // `${workerId}|${day}` -> row
  for (const e of events) {
    const day = dayOf(e.at);
    const key = `${e.workerId}|${day}`;
    if (seen.has(key)) continue;
    seen.set(key, {
      date: day,
      workerName: e.worker?.name || "—",
      jobTitle: e.worker?.jobTitle || null,
      site: e.site || null,
      dailyWage: e.worker?.dailyWage ?? null,
    });
  }
  const rows = Array.from(seen.values()).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.workerName.localeCompare(b.workerName)));
  const total = rows.reduce((s, r) => s + (Number(r.dailyWage) || 0), 0);
  const workerDays = rows.length;
  const unset = rows.filter((r) => r.dailyWage == null).length;

  if (csv) {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const out = [["Date", "Worker", "Job title", "Site", "Daily wage"]];
    for (const r of rows) out.push([r.date, r.workerName, r.jobTitle || "", r.site || "", r.dailyWage == null ? "" : r.dailyWage]);
    out.push([]);
    out.push(["", "", "", "Worker-days", workerDays]);
    out.push(["", "", "", "Total", total]);
    const body = out.map((r) => r.map(esc).join(",")).join("\n");
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="daily-wages.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return Response.json({ rows, total, workerDays, unset });
}
