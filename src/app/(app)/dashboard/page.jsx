import { getCurrentUser } from "@/lib/auth";
import Registry from "@/components/Registry";

export const metadata = { title: "Registry · QSL Reports" };

export default async function DashboardPage() {
  const claims = await getCurrentUser();
  const profile = { role: claims.role, name: claims.name };
  return <Registry profile={profile} />;
}
