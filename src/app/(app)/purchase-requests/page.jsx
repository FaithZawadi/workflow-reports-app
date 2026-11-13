import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canSeePurchaseRequests } from "@/lib/roles";
import PurchaseRequests from "@/components/PurchaseRequests";

export const metadata = { title: "Purchase requests · QSL" };

export default async function PurchaseRequestsPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canSeePurchaseRequests(claims)) redirect("/dashboard");
  return <PurchaseRequests profile={{ role: claims.role, roles: claims.roles, name: claims.name }} />;
}
