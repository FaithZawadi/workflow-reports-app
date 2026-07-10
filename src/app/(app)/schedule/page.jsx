import { getCurrentUser } from "@/lib/auth";
import Schedule from "@/components/Schedule";

export const metadata = { title: "Maintenance schedule · QSL Reports" };

export default async function SchedulePage() {
  const claims = await getCurrentUser();
  const profile = {
    role: claims.role,
    roles: claims.roles,
    name: claims.name,
    clientId: claims.clientId,
    site: claims.site,
  };
  return <Schedule profile={profile} />;
}
