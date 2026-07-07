import { getCurrentUser } from "@/lib/auth";
import ReportDetail from "@/components/ReportDetail";

export const metadata = { title: "Report · QSL Reports" };

export default async function ReportPage({ params }) {
  const claims = await getCurrentUser();
  const profile = { role: claims.role, name: claims.name };
  return <ReportDetail serial={params.serial} profile={profile} />;
}
