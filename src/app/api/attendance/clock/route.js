import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageAttendance } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMG = 900 * 1024;
const isImg = (s) => typeof s === "string" && /^data:image\/(png|jpe?g|webp);base64,/.test(s);

// POST /api/attendance/clock — record a clock IN or OUT for a worker, taken on
// the manager's phone. When `type` is omitted the punch auto-toggles from the
// worker's last event (IN if they were out, OUT if they were in).
export async function POST(req) {
  let user;
  try {
    user = await requireUser();
    if (!canManageAttendance(user)) return Response.json({ error: "Only a manager can run the clocking station." }, { status: 403 });
  } catch (res) {
    return res;
  }

  const body = await req.json().catch(() => ({}));
  const workerId = String(body.workerId || "").trim();
  if (!workerId) return Response.json({ error: "Pick a worker." }, { status: 400 });
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: { clockEvents: { orderBy: { at: "desc" }, take: 1, select: { type: true } } },
  });
  if (!worker || !worker.active) return Response.json({ error: "Worker not found." }, { status: 404 });

  // Auto-toggle unless an explicit type is given.
  const last = worker.clockEvents[0]?.type || null;
  let type = String(body.type || "").toUpperCase();
  if (type !== "IN" && type !== "OUT") type = last === "IN" ? "OUT" : "IN";

  const selfie = isImg(body.selfie) ? body.selfie : null;
  if (selfie && selfie.length > MAX_IMG) return Response.json({ error: "The selfie is too large." }, { status: 413 });
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

  // Offline punches are queued on the device and synced later, so honour an
  // explicit punch time (`at`) when it's sane: not in the future, not older than
  // 30 days. Otherwise stamp it now.
  let at = undefined;
  if (body.at) {
    const t = new Date(body.at);
    const ms = t.getTime();
    if (Number.isFinite(ms) && ms <= Date.now() + 120000 && ms >= Date.now() - 30 * 86400000) at = t;
  }

  const event = await prisma.clockEvent.create({
    data: {
      workerId: worker.id,
      type,
      ...(at ? { at } : {}),
      lat: num(body.lat),
      lng: num(body.lng),
      selfie,
      matchScore: num(body.matchScore),
      matched: typeof body.matched === "boolean" ? body.matched : null,
      byManagerId: user.sub || null,
      byManagerName: user.name || null,
      deviceLabel: String(body.deviceLabel || "").trim().slice(0, 80) || null,
      site: String(body.site || "").trim().slice(0, 120) || null,
    },
  });

  return Response.json({ ok: true, type: event.type, at: event.at, workerName: worker.name });
}
