import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canSeeQuotations } from "@/lib/roles";
import CalibrationRequestDetail from "@/components/CalibrationRequestDetail";

export const metadata = { title: "Calibration request · QSL" };

export default async function CalibrationRequestDetailPage({ params }) {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canSeeQuotations(claims)) redirect("/dashboard");
  return <CalibrationRequestDetail id={params.id} profile={{ role: claims.role, roles: claims.roles, name: claims.name }} />;
}
