import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Account from "@/components/Account";

export const metadata = { title: "Account · QSL Reports" };

export default async function AccountPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");

  let clientName = null;
  if (claims.clientId) {
    const c = await prisma.client.findUnique({ where: { id: claims.clientId } });
    clientName = c?.name || null;
  }

  return (
    <Account
      profile={{ name: claims.name, email: claims.email, role: claims.role, clientName, site: claims.site }}
    />
  );
}
