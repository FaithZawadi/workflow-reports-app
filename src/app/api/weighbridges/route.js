import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { weighbridgeScope, resolveManagerId } from "@/lib/weighbridge";
import { rolesOf, canManageWeighbridges, WEIGHBRIDGE_MANAGER_ROLES } from "@/lib/roles";

export const dynamic = "force-dynamic";

const shape = (w) => ({
  id: w.id,
  label: w.label,
  client: w.client?.name || null,
  clientId: w.clientId,
  site: w.site,
  makeModel: w.makeModel,
  serialNo: w.serialNo,
  capacity: w.capacity,
  deckLength: w.deckLength,
  active: w.active,
  // The correlated Client/Manager (approval routing).
  clientManagerId: w.clientManagerId || null,
  managerName: w.clientManager?.name || null,
  managerEmail: w.clientManager?.email || null,
});

const withManager = { client: { select: { name: true } }, clientManager: { select: { id: true, name: true, email: true } } };

// GET /api/weighbridges          -> weighbridges the current user may select
// GET /api/weighbridges?manage=1 -> full registry (admin) with usage counts
export async function GET(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const { searchParams } = new URL(req.url);

  if (searchParams.get("manage")) {
    if (!canManageWeighbridges(user))
      return Response.json({ error: "Not allowed." }, { status: 403 });
    const list = await prisma.weighbridge.findMany({
      orderBy: [{ active: "desc" }, { label: "asc" }],
      include: { ...withManager, _count: { select: { users: true } } },
    });
    return Response.json({ weighbridges: list.map((w) => ({ ...shape(w), users: w._count.users })) });
  }

  const clientName = (searchParams.get("client") || "").trim().toLowerCase();
  let list = await prisma.weighbridge.findMany({
    where: weighbridgeScope(user),
    orderBy: { label: "asc" },
    include: withManager,
  });
  // A supervisor/manager with no assignments yet shouldn't be blocked from filing.
  if (list.length === 0 && rolesOf(user).some((r) => ["SUPERVISOR", "MANAGER"].includes(r))) {
    list = await prisma.weighbridge.findMany({
      where: { active: true },
      orderBy: { label: "asc" },
      include: { client: { select: { name: true } } },
    });
  }
  if (clientName) list = list.filter((w) => (w.client?.name || "").toLowerCase() === clientName);
  return Response.json({ weighbridges: list.map(shape) });
}

// POST /api/weighbridges — administrators and Equipment Users register a weighbridge.
export async function POST(req) {
  let user;
  try {
    user = await requireUser(WEIGHBRIDGE_MANAGER_ROLES);
  } catch (res) {
    return res;
  }
  const b = await req.json().catch(() => ({}));
  const label = String(b.label || "").trim();
  const clientName = String(b.clientName || "").trim();
  if (!label) return Response.json({ error: "Weighbridge name/ID is required." }, { status: 400 });
  if (!clientName) return Response.json({ error: "Choose the client (plant)." }, { status: 400 });

  const client = await prisma.client.upsert({ where: { name: clientName }, create: { name: clientName }, update: {} });
  const clientManagerId = await resolveManagerId(b.clientManagerId);
  const w = await prisma.weighbridge.create({
    data: {
      clientId: client.id,
      label,
      site: String(b.site || "").trim() || null,
      makeModel: String(b.makeModel || "").trim() || null,
      serialNo: String(b.serialNo || "").trim() || null,
      capacity: String(b.capacity || "").trim() || null,
      deckLength: String(b.deckLength || "").trim() || null,
      clientManagerId,
    },
  });
  await recordAudit({
    actor: user,
    action: "CREATE",
    entity: "WEIGHBRIDGE",
    entityId: w.id,
    summary: `Registered weighbridge ${label} at ${clientName}`,
  });
  return Response.json({ weighbridge: shape({ ...w, client: { name: clientName } }) });
}
