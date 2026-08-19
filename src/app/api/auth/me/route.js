import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assignedClientsFor } from "@/lib/assignments";

export async function GET() {
  const claims = await getCurrentUser();
  if (!claims) return Response.json({ user: null }, { status: 200 });

  // Load fresh profile so deactivation / role changes take effect.
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    include: { client: true },
  });
  if (!user || !user.active) return Response.json({ user: null }, { status: 200 });

  const { assignedClients, primaryName } = await assignedClientsFor(user.id);

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      roles: user.roles && user.roles.length ? user.roles : [user.role],
      clientId: user.clientId,
      // The client to show/prefill — the serving/employer/assigned client.
      clientName: primaryName || user.client?.name || null,
      // Every client this user may file for (for the client picker).
      assignedClients,
      site: user.site,
    },
  });
}
