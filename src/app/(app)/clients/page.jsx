import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { rolesOf } from "@/lib/roles";
import ClientsAdmin from "@/components/ClientsAdmin";

export const metadata = { title: "Clients · QSL Reports" };

export default async function ClientsPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!rolesOf(claims).includes("ADMIN")) redirect("/dashboard");
  return <ClientsAdmin />;
}
