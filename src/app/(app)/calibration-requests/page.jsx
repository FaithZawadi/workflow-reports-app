import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canSeeQuotations } from "@/lib/roles";
import CalibrationRequests from "@/components/CalibrationRequests";

export const metadata = { title: "Calibration requests · QSL" };

export default async function CalibrationRequestsPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canSeeQuotations(claims)) redirect("/dashboard");
  return <CalibrationRequests profile={{ role: claims.role, roles: claims.roles, name: claims.name }} />;
}
