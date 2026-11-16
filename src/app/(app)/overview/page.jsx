import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canGenerateReports } from "@/lib/roles";
import Dashboard from "@/components/Dashboard";
import ManagementReport from "@/components/ManagementReport";

export const metadata = { title: "Dashboard · QSL" };

// One dashboard. Managers / admins (anyone who may generate reports) get the
// full, detailed management dashboard here; field staff and clients get the
// lighter live overview. The old separate "Management report" page redirects
// here so there is a single home.
export default async function OverviewPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (canGenerateReports(claims)) return <ManagementReport />;
  return <Dashboard profile={{ role: claims.role, roles: claims.roles, name: claims.name }} />;
}
