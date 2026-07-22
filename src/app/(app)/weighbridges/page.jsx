import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canManageWeighbridges, rolesOf } from "@/lib/roles";
import WeighbridgesAdmin from "@/components/WeighbridgesAdmin";

export const metadata = { title: "Weighbridges · QSL Reports" };

export default async function WeighbridgesPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canManageWeighbridges(claims)) redirect("/overview");
  // Equipment Users can register weighbridges but not edit/delete existing ones.
  const canAdminister = rolesOf(claims).includes("ADMIN");
  return <WeighbridgesAdmin canAdminister={canAdminister} />;
}
