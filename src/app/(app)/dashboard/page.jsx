import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isClientOnly } from "@/lib/roles";
import Registry from "@/components/Registry";

export const metadata = { title: "Registry · QSL Reports" };

export default async function DashboardPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  // A client-only login has no report registry — send them to their portal.
  if (isClientOnly(claims)) redirect("/calibration-requests");
  const profile = { role: claims.role, name: claims.name };
  return <Registry profile={profile} />;
}
