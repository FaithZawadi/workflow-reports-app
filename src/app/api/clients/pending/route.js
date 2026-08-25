import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { rolesOf } from "@/lib/roles";

export const dynamic = "force-dynamic";

// GET /api/clients/pending — clients awaiting approval that the current user may
// act on: the chosen approver sees theirs; an admin sees all.
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const isAdmin = rolesOf(user).includes("ADMIN");
  const where = { approvalStatus: "PENDING", ...(isAdmin ? {} : { approverId: user.sub }) };

  const list = await prisma.client.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      approver: { select: { name: true } },
      sites: { where: { active: true }, select: { name: true } },
    },
  });

  return Response.json({
    clients: list.map((c) => ({
      id: c.id,
      name: c.name,
      registeredByName: c.registeredByName,
      approverName: c.approver?.name || null,
      sites: c.sites.map((s) => s.name),
      createdAt: c.createdAt,
    })),
  });
}
