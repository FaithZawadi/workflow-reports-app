import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canApproveClients } from "@/lib/roles";

export const dynamic = "force-dynamic";

// GET /api/clients/pending — every registration awaiting approval. Any approver
// (admin / manager / PM / TM) sees ALL pending clients and pending sites, not
// just the ones routed to them.
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canApproveClients(user)) return Response.json({ clients: [], sites: [] });

  const [clients, sites] = await Promise.all([
    prisma.client.findMany({
      where: { approvalStatus: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        approver: { select: { name: true } },
        sites: { where: { active: true }, select: { name: true } },
      },
    }),
    prisma.site.findMany({
      where: { approvalStatus: "PENDING", active: true },
      orderBy: { createdAt: "asc" },
      include: { client: { select: { name: true } } },
    }),
  ]);

  return Response.json({
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      registeredByName: c.registeredByName,
      approverName: c.approver?.name || null,
      sites: c.sites.map((s) => s.name),
      createdAt: c.createdAt,
    })),
    sites: sites.map((s) => ({
      id: s.id,
      name: s.name,
      clientName: s.client?.name || "—",
      registeredByName: s.registeredByName,
      createdAt: s.createdAt,
    })),
  });
}
