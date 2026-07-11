import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canManageTasks } from "@/lib/roles";
import ContractsAdmin from "@/components/ContractsAdmin";

export const metadata = { title: "Contracts · QSL Reports" };

export default async function ContractsPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canManageTasks(claims)) redirect("/dashboard");
  return <ContractsAdmin />;
}
