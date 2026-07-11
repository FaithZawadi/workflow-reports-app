import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { rolesOf } from "@/lib/roles";

export const dynamic = "force-dynamic";

const shape = (s) => ({
  id: s.id,
  name: s.name,
  client: s.client?.name || null,
  clientId: s.clientId,
  active: s.active,
});

// GET /api/sites            -> sites the current user may pick when filing
// GET /api/sites?manage=1   -> full catalogue (admin) with client names
// GET /api/sites?client=ACME-> sites for that client (plus global, client-less)
export async function GET(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const { searchParams } = new URL(req.url);

  if (searchParams.get("manage")) {
    if (!rolesOf(user).includes("ADMIN"))
      return Response.json({ error: "Not allowed." }, { status: 403 });
    const list = await prisma.site.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { client: { select: { name: true } } },
    });
    return Response.json({ sites: list.map(shape) });
  }

  const clientName = (searchParams.get("client") || "").trim().toLowerCase();
  let list = await prisma.site.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { client: { select: { name: true } } },
  });
  // Show sites for the chosen client plus any global (client-less) ones.
  if (clientName) {
    list = list.filter((s) => !s.client || (s.client.name || "").toLowerCase() === clientName);
  }
  return Response.json({ sites: list.map(shape) });
}

// POST /api/sites — administrators register a site / location.
export async function POST(req) {
  let user;
  try {
    user = await requireUser(["ADMIN"]);
  } catch (res) {
    return res;
  }
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  const clientName = String(b.clientName || "").trim();
  if (!name) return Response.json({ error: "Site / location name is required." }, { status: 400 });

  let clientId = null;
  if (clientName) {
    const client = await prisma.client.upsert({ where: { name: clientName }, create: { name: clientName }, update: {} });
    clientId = client.id;
  }
  const s = await prisma.site.create({ data: { name, clientId } });
  await recordAudit({
    actor: user,
    action: "CREATE",
    entity: "SITE",
    entityId: s.id,
    summary: `Registered site ${name}${clientName ? " at " + clientName : ""}`,
  });
  return Response.json({ site: shape({ ...s, client: clientName ? { name: clientName } : null }) });
}
