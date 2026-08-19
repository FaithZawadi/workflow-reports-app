import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { rolesOf } from "@/lib/roles";
import { clientDetailData } from "@/lib/clientFields";

export const dynamic = "force-dynamic";

// GET /api/clients          -> active clients for the filing dropdown
// GET /api/clients?manage=1 -> full registry (admin): sites + report counts
export async function GET(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const { searchParams } = new URL(req.url);

  if (searchParams.get("manage")) {
    if (!rolesOf(user).includes("ADMIN")) return Response.json({ error: "Not allowed." }, { status: 403 });
    const list = await prisma.client.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        sites: {
          orderBy: [{ active: "desc" }, { name: "asc" }],
          select: { id: true, name: true, active: true, address: true, city: true, lat: true, lng: true, geofenceRadius: true, contactPerson: true, contactPhone: true, notes: true },
        },
        accountManager: { select: { id: true, name: true } },
        _count: { select: { reports: true, weighbridges: true } },
      },
    });
    return Response.json({
      clients: list.map((c) => ({
        id: c.id,
        name: c.name,
        active: c.active,
        displayName: c.displayName,
        clientType: c.clientType,
        contactPerson: c.contactPerson,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
        billingEmail: c.billingEmail,
        taxPin: c.taxPin,
        regNo: c.regNo,
        address: c.address,
        city: c.city,
        country: c.country,
        website: c.website,
        notes: c.notes,
        status: c.status,
        onboardedAt: c.onboardedAt,
        accountManagerId: c.accountManagerId,
        accountManager: c.accountManager,
        sites: c.sites,
        reportCount: c._count.reports,
        weighbridgeCount: c._count.weighbridges,
      })),
    });
  }

  const clients = await prisma.client.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return Response.json({ clients });
}

// POST /api/clients — register a client (admins + report-generating managers).
export async function POST(req) {
  let user;
  try {
    user = await requireUser(["ADMIN", "ENGINEER", "PROJECT_MANAGER", "TECHNICAL_MANAGER"]);
  } catch (res) {
    return res;
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return Response.json({ error: "Enter a client name." }, { status: 400 });

  // Case-insensitive guard so "Tata Chemicals" and "TATA CHEMICALS" don't split.
  const existing = await prisma.client.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) {
    if (!existing.active) await prisma.client.update({ where: { id: existing.id }, data: { active: true } });
    return Response.json({ client: { id: existing.id, name: existing.name } });
  }

  const client = await prisma.client.create({
    data: { name, ...clientDetailData(body) },
    select: { id: true, name: true },
  });
  await recordAudit({ actor: user, action: "CREATE", entity: "CLIENT", entityId: client.id, summary: `Registered client ${client.name}` });
  return Response.json({ client });
}
