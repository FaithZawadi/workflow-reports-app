import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { canManageAttendance } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireManager() {
  const user = await requireUser();
  if (!canManageAttendance(user)) {
    throw Response.json({ error: "Only a manager can manage attendance." }, { status: 403 });
  }
  return user;
}

// GET /api/attendance/sites — the sites a worker can be assigned to (the shared
// site catalogue). Active sites only, lightest shape for the picker.
export async function GET() {
  try {
    await requireManager();
  } catch (res) {
    return res;
  }
  const sites = await prisma.site.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, address: true },
  });
  return Response.json({ sites });
}

// POST /api/attendance/sites — register a new work site inline, just like the
// main system's site register. Created client-less (a standalone work site) and
// approved outright since an attendance manager made it. Audited.
export async function POST(req) {
  let user;
  try {
    user = await requireManager();
  } catch (res) {
    return res;
  }
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim().slice(0, 120);
  if (!name) return Response.json({ error: "A site name is required." }, { status: 400 });

  // Avoid duplicates by name (case-insensitive) among active sites.
  const existing = await prisma.site.findFirst({
    where: { active: true, name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true, city: true },
  });
  if (existing) return Response.json({ ok: true, site: existing, existed: true });

  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const site = await prisma.site.create({
    data: {
      name,
      city: String(b.city || "").trim().slice(0, 80) || null,
      address: String(b.address || "").trim().slice(0, 200) || null,
      lat: num(b.lat),
      lng: num(b.lng),
      approvalStatus: "APPROVED",
      registeredById: user.sub || null,
      registeredByName: user.name || null,
      approvedAt: new Date(),
    },
    select: { id: true, name: true, city: true },
  });

  await recordAudit({
    actor: user,
    action: "CREATE",
    entity: "SITE",
    entityId: site.id,
    summary: `Work site "${site.name}" registered by ${user.name} (via attendance)`,
  });

  return Response.json({ ok: true, site });
}
