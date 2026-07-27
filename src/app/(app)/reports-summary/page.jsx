import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canGenerateReports } from "@/lib/roles";
import ManagementReport from "@/components/ManagementReport";

export const metadata = { title: "Management report · QSL" };

export default async function ReportsSummaryPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canGenerateReports(claims)) redirect("/overview");
  return <ManagementReport />;
}
