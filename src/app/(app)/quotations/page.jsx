import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canSeeQuotations } from "@/lib/roles";
import Quotations from "@/components/Quotations";

export const metadata = { title: "Quotations · QSL" };

export default async function QuotationsPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canSeeQuotations(claims)) redirect("/dashboard");
  return <Quotations profile={{ role: claims.role, roles: claims.roles, name: claims.name }} />;
}
