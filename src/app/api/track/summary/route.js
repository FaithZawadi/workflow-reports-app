import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 86400000;

// GET /api/track/summary?days=30 — visits & clicks analytics for admins.
export async function GET(req) {
  try {
    await requireUser(["ADMIN"]);
  } catch (res) {
    return res;
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30", 10) || 30));
  const since = new Date(Date.now() - days * DAY);

  const rows = await prisma.visitEvent
    .findMany({
      where: { createdAt: { gte: since } },
      select: { type: true, path: true, label: true, sessionId: true, userId: true, role: true, device: true, ref: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 100000,
    })
    .catch(() => []);

  const views = rows.filter((r) => r.type === "pageview");
  const clicks = rows.filter((r) => r.type === "click");

  const uniq = (arr, key) => new Set(arr.map((r) => r[key]).filter(Boolean)).size;

  // Daily (or weekly for long spans) time series of views + unique sessions.
  const bucketMs = days > 92 ? 7 * DAY : DAY;
  const start = new Date(since); start.setHours(0, 0, 0, 0);
  const buckets = new Map();
  for (const v of views) {
    const idx = Math.floor((new Date(v.createdAt).getTime() - start.getTime()) / bucketMs);
    const b = buckets.get(idx) || { views: 0, sessions: new Set() };
    b.views += 1; b.sessions.add(v.sessionId);
    buckets.set(idx, b);
  }
  const nB = Math.floor((Date.now() - start.getTime()) / bucketMs) + 1;
  const trend = [];
  for (let i = 0; i < nB; i++) {
    const b = buckets.get(i);
    trend.push({
      date: new Date(start.getTime() + i * bucketMs).toISOString().slice(0, 10),
      views: b ? b.views : 0,
      visitors: b ? b.sessions.size : 0,
    });
  }

  const tally = (arr, key) => {
    const m = new Map();
    for (const r of arr) { const k = r[key] || "—"; m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  };

  // Unique visitors per day sparkline / today.
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayViews = views.filter((v) => new Date(v.createdAt) >= todayStart);

  return Response.json({
    range: { days, from: since.toISOString().slice(0, 10) },
    totals: {
      views: views.length,
      visitors: uniq(views, "sessionId"),
      clicks: clicks.length,
      signedInVisitors: uniq(views.filter((v) => v.userId), "userId"),
      viewsToday: todayViews.length,
      visitorsToday: uniq(todayViews, "sessionId"),
    },
    trend,
    topPages: tally(views, "path").slice(0, 12),
    topClicks: tally(clicks, "label").slice(0, 12),
    devices: tally(views, "device"),
    referrers: tally(views.filter((v) => v.ref), "ref").slice(0, 8),
    byRole: tally(views.filter((v) => v.role), "role"),
  });
}
