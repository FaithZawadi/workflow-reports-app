import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canSeeInvoices } from "@/lib/roles";
import Invoices from "@/components/Invoices";

export const metadata = { title: "Invoices · QSL" };

export default async function InvoicesPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canSeeInvoices(claims)) redirect("/dashboard");
  return <Invoices profile={{ role: claims.role, roles: claims.roles, name: claims.name }} />;
}
