import { getCurrentUser } from "@/lib/auth";
import ScheduleBoard from "@/components/ScheduleBoard";

export const metadata = { title: "Schedule · QSL Reports" };

export default async function SchedulePage() {
  const claims = await getCurrentUser();
  const profile = { role: claims.role, name: claims.name };
  return <ScheduleBoard profile={profile} />;
}
