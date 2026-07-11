import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { rolesOf } from "@/lib/roles";
import SitesAdmin from "@/components/SitesAdmin";

export const metadata = { title: "Sites · QSL Reports" };

export default async function SitesPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!rolesOf(claims).includes("ADMIN")) redirect("/dashboard");
  return <SitesAdmin />;
}
