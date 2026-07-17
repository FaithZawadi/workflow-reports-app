import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isClient, canPrepareQuotes, rolesOf } from "@/lib/roles";
import CalibrationRequestForm from "@/components/CalibrationRequestForm";

export const metadata = { title: "New calibration request · QSL" };

export default async function NewCalibrationRequestPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  const allowed = isClient(claims) || canPrepareQuotes(claims) || rolesOf(claims).includes("ADMIN");
  if (!allowed) redirect("/dashboard");
  return (
    <CalibrationRequestForm
      profile={{ name: claims.name, email: claims.email, roles: claims.roles, clientId: claims.clientId, clientName: claims.clientName || "" }}
    />
  );
}
