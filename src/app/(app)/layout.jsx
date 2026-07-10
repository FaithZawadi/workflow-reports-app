import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }) {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    include: { client: true },
  });
  if (!user || !user.active) redirect("/login");

  const profile = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roles: user.roles && user.roles.length ? user.roles : [user.role],
    clientId: user.clientId,
    clientName: user.client?.name || null,
    site: user.site,
  };

  return <AppShell user={profile}>{children}</AppShell>;
}
