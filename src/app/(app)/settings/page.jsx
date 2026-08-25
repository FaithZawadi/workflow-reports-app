import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { rolesOf } from "@/lib/roles";
import SystemSettings from "@/components/SystemSettings";

export const metadata = { title: "System settings · QSL Reports" };

export default async function SystemSettingsPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  // Only administrators may view or change application-wide settings.
  if (!rolesOf(claims).includes("ADMIN")) redirect("/dashboard");
  return <SystemSettings />;
}
