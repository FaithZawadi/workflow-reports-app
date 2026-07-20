import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

export const metadata = { title: "Dashboard · QSL" };

export default async function OverviewPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  return <Dashboard profile={{ role: claims.role, roles: claims.roles, name: claims.name }} />;
}
