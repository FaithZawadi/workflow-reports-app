import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageAttendance } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMG = 900 * 1024; // ~900 KB per data URL
const isImg = (s) => typeof s === "string" && /^data:image\/(png|jpe?g|webp);base64,/.test(s);

async function requireManager() {
  const user = await requireUser();
  if (!canManageAttendance(user)) {
    throw Response.json({ error: "Only a manager can manage attendance." }, { status: 403 });
  }
  return user;
}

// GET /api/attendance/workers — the registered workers (active by default), each
// with their current clocked state so the kiosk can show IN / OUT.
export async function GET(req) {
  try {
    await requireManager();
  } catch (res) {
    return res;
  }
  const all = new URL(req.url).searchParams.get("all") === "1";
  const workers = await prisma.worker.findMany({
    where: all ? {} : { active: true },
    orderBy: { name: "asc" },
    include: { clockEvents: { orderBy: { at: "desc" }, take: 1, select: { type: true, at: true } } },
  });
  const out = workers.map((w) => ({
    id: w.id,
    name: w.name,
    phone: w.phone,
    jobTitle: w.jobTitle,
    photo: w.photo,
    active: w.active,
    hasFace: Array.isArray(w.faceDescriptor) && w.faceDescriptor.length > 0,
    faceDescriptor: Array.isArray(w.faceDescriptor) ? w.faceDescriptor : [],
    lastType: w.clockEvents[0]?.type || null,
    lastAt: w.clockEvents[0]?.at || null,
  }));
  return Response.json({ workers: out });
}

// POST /api/attendance/workers — one-time registration of a worker.
export async function POST(req) {
  let user;
  try {
    user = await requireManager();
  } catch (res) {
    return res;
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 120);
  if (!name) return Response.json({ error: "A worker name is required." }, { status: 400 });
  const photo = isImg(body.photo) ? body.photo : null;
  if (photo && photo.length > MAX_IMG) return Response.json({ error: "The photo is too large." }, { status: 413 });
  const descriptor = Array.isArray(body.faceDescriptor)
    ? body.faceDescriptor.map(Number).filter((n) => Number.isFinite(n)).slice(0, 128)
    : [];

  const worker = await prisma.worker.create({
    data: {
      name,
      phone: String(body.phone || "").trim().slice(0, 40) || null,
      jobTitle: String(body.jobTitle || "").trim().slice(0, 60) || null,
      photo,
      faceDescriptor: descriptor,
      registeredById: user.sub || null,
      registeredByName: user.name || null,
    },
  });
  return Response.json({ ok: true, worker: { id: worker.id, name: worker.name } });
}
