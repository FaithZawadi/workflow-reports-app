import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageAttendance } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Kenya is UTC+3 with no DST, so day boundaries are a fixed offset.
const EAT = "+03:00";
const dayOf = (at) => new Date(at).toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
const hhmm = (at) => new Date(at).toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit" });
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00" + EAT); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// The inclusive [from, to] day range (YYYY-MM-DD) for a period anchored on `date`.
function rangeFor(period, date) {
  const d = new Date((date || new Date().toISOString().slice(0, 10)) + "T12:00:00" + EAT);
  if (period === "week") {
    // ISO week: Monday..Sunday containing the date.
    const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
    const from = addDays(date, -dow);
    return { from, to: addDays(from, 6) };
  }
  if (period === "month") {
    const y = d.getUTCFullYear(), m = d.getUTCMonth();
    const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return { from, to: `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
  }
  return { from: date, to: date }; // day
}

function listDays(from, to) {
  const out = [];
  let cur = from;
  for (let i = 0; i < 400 && cur <= to; i++) { out.push(cur); cur = addDays(cur, 1); }
  return out;
}

// Pair IN→OUT events within a worker's day and total the minutes worked.
function sessionsFor(events, isToday) {
  const sorted = [...events].sort((a, b) => new Date(a.at) - new Date(b.at));
  let openIn = null, minutes = 0, sessions = 0, firstIn = null, lastOut = null, open = false;
  for (const e of sorted) {
    if (e.type === "IN") { if (!firstIn) firstIn = e.at; openIn = e.at; }
    else if (e.type === "OUT") { lastOut = e.at; if (openIn) { minutes += (new Date(e.at) - new Date(openIn)) / 60000; sessions += 1; openIn = null; } }
  }
  if (openIn) { open = true; if (isToday) minutes += (Date.now() - new Date(openIn)) / 60000; }
  return { minutes: Math.max(0, Math.round(minutes)), sessions, firstIn, lastOut, open };
}

// GET /api/attendance/report?period=day|week|month&date=YYYY-MM-DD&site=&format=csv
// Clocking timesheet: hours worked per worker per day over the chosen period,
// with day/week/month totals. Hours come from paired IN→OUT clock events.
export async function GET(req) {
  try {
    const user = await requireUser();
    if (!canManageAttendance(user)) return Response.json({ error: "Only a manager can view clocking reports." }, { status: 403 });
  } catch (res) {
    return res;
  }

  const sp = new URL(req.url).searchParams;
  const period = ["day", "week", "month"].includes(sp.get("period")) ? sp.get("period") : "day";
  const date = (sp.get("date") || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const site = sp.get("site") || "";
  const csv = sp.get("format") === "csv";
  const { from, to } = rangeFor(period, date);
  const days = listDays(from, to);
  const today = dayOf(new Date());

  const where = { at: { gte: new Date(from + "T00:00:00" + EAT), lte: new Date(to + "T23:59:59.999" + EAT) } };
  if (site) where.site = site;

  const events = await prisma.clockEvent.findMany({
    where,
    orderBy: { at: "asc" },
    take: 50000,
    select: { workerId: true, type: true, at: true, site: true, worker: { select: { name: true, jobTitle: true, dailyWage: true } } },
  });

  // Group events by worker then day.
  const byWorker = new Map();
  for (const e of events) {
    if (!byWorker.has(e.workerId)) byWorker.set(e.workerId, { name: e.worker?.name || "—", jobTitle: e.worker?.jobTitle || null, dailyWage: e.worker?.dailyWage ?? null, site: e.site || null, days: new Map() });
    const w = byWorker.get(e.workerId);
    if (e.site) w.site = e.site;
    const d = dayOf(e.at);
    if (!w.days.has(d)) w.days.set(d, []);
    w.days.get(d).push(e);
  }

  const workers = [];
  let grandMinutes = 0, grandDays = 0;
  for (const [id, w] of byWorker) {
    const perDay = {};
    let totalMinutes = 0, daysPresent = 0;
    for (const d of days) {
      const evs = w.days.get(d);
      if (!evs || !evs.length) continue;
      const s = sessionsFor(evs, d === today);
      perDay[d] = { minutes: s.minutes, firstIn: s.firstIn ? hhmm(s.firstIn) : null, lastOut: s.lastOut ? hhmm(s.lastOut) : null, sessions: s.sessions, open: s.open };
      totalMinutes += s.minutes;
      daysPresent += 1;
    }
    if (daysPresent === 0) continue;
    workers.push({ id, name: w.name, jobTitle: w.jobTitle, site: w.site, dailyWage: w.dailyWage, perDay, totalMinutes, daysPresent });
    grandMinutes += totalMinutes;
    grandDays += daysPresent;
  }
  workers.sort((a, b) => a.name.localeCompare(b.name));

  const payload = { period, from, to, days, workers, totals: { minutes: grandMinutes, workerDays: grandDays, workers: workers.length } };

  if (csv) {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const hrs = (m) => (m / 60).toFixed(2);
    const rows = [];
    if (period === "day") {
      rows.push(["Date", "Worker", "Job title", "Site", "First in", "Last out", "Sessions", "Hours"]);
      for (const w of workers) { const d = w.perDay[from] || {}; rows.push([from, w.name, w.jobTitle || "", w.site || "", d.firstIn || "", d.lastOut || "", d.sessions || 0, hrs(w.totalMinutes)]); }
    } else {
      rows.push(["Worker", "Job title", "Site", ...days, "Days", "Total hours"]);
      for (const w of workers) rows.push([w.name, w.jobTitle || "", w.site || "", ...days.map((d) => (w.perDay[d] ? hrs(w.perDay[d].minutes) : "")), w.daysPresent, hrs(w.totalMinutes)]);
    }
    rows.push([]);
    rows.push(["", "", "Totals", ...(period === "day" ? [] : days.map(() => "")), period === "day" ? "" : grandDays, hrs(grandMinutes)]);
    const body = rows.map((r) => r.map(esc).join(",")).join("\n");
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="clocking-${period}-${from}.csv"`, "Cache-Control": "no-store" },
    });
  }

  return Response.json(payload);
}
