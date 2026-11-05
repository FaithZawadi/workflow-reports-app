import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageAttendance } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/attendance/events — the clock-in/out log for the attendance report.
// Filters: ?from=YYYY-MM-DD&to=YYYY-MM-DD&workerId=...  ?photos=1 includes the
// selfie data URLs (heavier). ?format=csv downloads a spreadsheet.
export async function GET(req) {
  try {
    const user = await requireUser();
    if (!canManageAttendance(user)) return Response.json({ error: "Only a manager can view attendance." }, { status: 403 });
  } catch (res) {
    return res;
  }

  const sp = new URL(req.url).searchParams;
  const workerId = sp.get("workerId") || undefined;
  const photos = sp.get("photos") === "1";
  const csv = sp.get("format") === "csv";
  const where = {};
  if (workerId) where.workerId = workerId;
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
    orderBy: { at: "desc" },
    take: csv ? 5000 : 1000,
    include: { worker: { select: { name: true, jobTitle: true } } },
  });

  if (csv) {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Worker", "Job title", "Site", "Type", "When (EAT)", "Matched", "Latitude", "Longitude", "By (manager)"]];
    for (const e of events) {
      rows.push([
        e.worker?.name || "",
        e.worker?.jobTitle || "",
        e.site || "",
        e.type,
        new Date(e.at).toLocaleString("en-GB", { timeZone: "Africa/Nairobi" }),
        e.matched == null ? "" : e.matched ? "Yes" : "No",
        e.lat ?? "",
        e.lng ?? "",
        e.byManagerName || "",
      ]);
    }
    const body = rows.map((r) => r.map(esc).join(",")).join("\n");
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const out = events.map((e) => ({
    id: e.id,
    workerName: e.worker?.name || "—",
    jobTitle: e.worker?.jobTitle || null,
    site: e.site || null,
    type: e.type,
    at: e.at,
    matched: e.matched,
    matchScore: e.matchScore,
    lat: e.lat,
    lng: e.lng,
    byManagerName: e.byManagerName,
    hasSelfie: !!e.selfie,
    selfie: photos ? e.selfie : undefined,
  }));
  return Response.json({ events: out });
}
