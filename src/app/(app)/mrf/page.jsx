import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canSeePurchaseRequests } from "@/lib/roles";
import MrfForms from "@/components/MrfForms";

export const metadata = { title: "Material requisition (MRF) · QSL" };

export default async function MrfPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canSeePurchaseRequests(claims)) redirect("/overview");
  return <MrfForms profile={{ role: claims.role, roles: claims.roles, name: claims.name }} />;
}
