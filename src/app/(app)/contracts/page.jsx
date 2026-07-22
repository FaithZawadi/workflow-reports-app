import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canManageProjects } from "@/lib/roles";
import ContractsAdmin from "@/components/ContractsAdmin";

export const metadata = { title: "Contracts · QSL Reports" };

export default async function ContractsPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canManageProjects(claims)) redirect("/overview");
  return <ContractsAdmin />;
}
