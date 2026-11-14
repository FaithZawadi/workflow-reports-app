import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { canManageAttendance } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMG = 900 * 1024; // ~900 KB per face selfie
const MAX_DOC = 1800 * 1024; // ~1.8 MB for an ID document scan
const isImg = (s) => typeof s === "string" && /^data:image\/(png|jpe?g|webp);base64,/.test(s);
const clean = (v, n) => String(v || "").trim().slice(0, n) || null;

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
    idNumber: w.idNumber,
    gender: w.gender,
    address: w.address,
    nextOfKin: w.nextOfKin,
    nextOfKinPhone: w.nextOfKinPhone,
    photo: w.photo,
    idPhoto: w.idPhoto,
    siteId: w.siteId,
    siteName: w.siteName,
    active: w.active,
    registeredByName: w.registeredByName,
    createdAt: w.createdAt,
    hasFace: Array.isArray(w.faceDescriptor) && w.faceDescriptor.length > 0,
    faceDescriptor: Array.isArray(w.faceDescriptor) ? w.faceDescriptor : [],
    lastType: w.clockEvents[0]?.type || null,
    lastAt: w.clockEvents[0]?.at || null,
  }));
  return Response.json({ workers: out });
}

// POST /api/attendance/workers — one-time registration of a worker with their
// full details, ID document and assigned site. A person can only be registered
// once (face + ID number are both checked).
export async function POST(req) {
  let user;
  try {
    user = await requireManager();
  } catch (res) {
    return res;
  }
  const body = await req.json().catch(() => ({}));
  const name = clean(body.name, 120);
  if (!name) return Response.json({ error: "A worker name is required." }, { status: 400 });

  const idNumber = clean(body.idNumber, 40);
  if (!idNumber) return Response.json({ error: "The worker's ID number is required." }, { status: 400 });

  const photo = isImg(body.photo) ? body.photo : null;
  if (photo && photo.length > MAX_IMG) return Response.json({ error: "The face photo is too large." }, { status: 413 });

  const idPhoto = isImg(body.idPhoto) ? body.idPhoto : null;
  if (!idPhoto) return Response.json({ error: "Attach a photo of the worker's ID document." }, { status: 400 });
  if (idPhoto.length > MAX_DOC) return Response.json({ error: "The ID photo is too large — retake it a little smaller." }, { status: 413 });

  const descriptor = Array.isArray(body.faceDescriptor)
    ? body.faceDescriptor.map(Number).filter((n) => Number.isFinite(n)).slice(0, 128)
    : [];

  // No re-registration (1): the same ID number can't be registered twice.
  const dupId = await prisma.worker.findFirst({
    where: { idNumber: { equals: idNumber, mode: "insensitive" } },
    select: { id: true, name: true, active: true },
  });
  if (dupId) {
    return Response.json(
      { error: `ID number ${idNumber} is already registered as “${dupId.name}”${dupId.active ? "" : " (inactive)"}. Each person can only be registered once — change that worker's site instead.`, duplicate: { id: dupId.id, name: dupId.name } },
      { status: 409 }
    );
  }

  // No re-registration (2): the same face can't be registered twice. Compare the
  // new descriptor to every active worker's registered face (distance < 0.5).
  if (descriptor.length === 128) {
    const DUP_THRESHOLD = 0.5;
    const existing = await prisma.worker.findMany({
      where: { active: true },
      select: { id: true, name: true, jobTitle: true, faceDescriptor: true },
    });
    let best = null;
    for (const w of existing) {
      const d = w.faceDescriptor;
      if (!Array.isArray(d) || d.length !== 128) continue;
      let sum = 0;
      for (let i = 0; i < 128; i++) { const diff = descriptor[i] - d[i]; sum += diff * diff; }
      const dist = Math.sqrt(sum);
      if (best === null || dist < best.dist) best = { dist, id: w.id, name: w.name, jobTitle: w.jobTitle };
    }
    if (best && best.dist < DUP_THRESHOLD) {
      return Response.json(
        {
          error: `This face is already registered as “${best.name}”${best.jobTitle ? ` (${best.jobTitle})` : ""}. Each person can only be registered once — change that worker's site instead of adding a new one.`,
          duplicate: { id: best.id, name: best.name, jobTitle: best.jobTitle, distance: Math.round(best.dist * 1000) / 1000 },
        },
        { status: 409 }
      );
    }
  }

  // Resolve the assigned site (if any) and snapshot its name.
  let siteId = null;
  let siteName = null;
  if (body.siteId) {
    const site = await prisma.site.findUnique({ where: { id: String(body.siteId) }, select: { id: true, name: true } });
    if (!site) return Response.json({ error: "That site wasn't found — pick it again or add it." }, { status: 400 });
    siteId = site.id;
    siteName = site.name;
  }

  const worker = await prisma.worker.create({
    data: {
      name,
      phone: clean(body.phone, 40),
      jobTitle: clean(body.jobTitle, 60),
      idNumber,
      idPhoto,
      gender: clean(body.gender, 20),
      address: clean(body.address, 200),
      nextOfKin: clean(body.nextOfKin, 120),
      nextOfKinPhone: clean(body.nextOfKinPhone, 40),
      photo,
      faceDescriptor: descriptor,
      siteId,
      siteName,
      registeredById: user.sub || null,
      registeredByName: user.name || null,
    },
  });

  await recordAudit({
    actor: user,
    action: "CREATE",
    entity: "WORKER",
    entityId: worker.id,
    summary: `Worker "${worker.name}" (ID ${idNumber}) registered by ${user.name}${siteName ? ` · site ${siteName}` : ""}`,
  });

  return Response.json({ ok: true, worker: { id: worker.id, name: worker.name } });
}
