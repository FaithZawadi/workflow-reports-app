import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canSeeQuotations } from "@/lib/roles";
import QuotationDetail from "@/components/QuotationDetail";

export const metadata = { title: "Quotation · QSL" };

export default async function QuotationDetailPage({ params }) {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canSeeQuotations(claims)) redirect("/dashboard");
  return <QuotationDetail id={params.id} profile={{ role: claims.role, roles: claims.roles, name: claims.name }} />;
}
