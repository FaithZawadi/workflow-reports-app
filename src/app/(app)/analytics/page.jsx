import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { rolesOf } from "@/lib/roles";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

export const metadata = { title: "Usage analytics · QSL Reports" };

export default async function AnalyticsPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!rolesOf(claims).includes("ADMIN")) redirect("/dashboard");
  return <AnalyticsDashboard />;
}
