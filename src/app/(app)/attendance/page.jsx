import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canManageAttendance } from "@/lib/roles";
import AttendanceAdmin from "@/components/AttendanceAdmin";

export const metadata = { title: "Attendance · QSL Reports" };

export default async function AttendancePage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canManageAttendance(claims)) redirect("/overview");
  return <AttendanceAdmin />;
}
