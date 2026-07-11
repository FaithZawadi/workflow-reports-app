import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Tasks from "@/components/Tasks";

export const metadata = { title: "Tasks · QSL Reports" };

export default async function TasksPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  const profile = { role: claims.role, roles: claims.roles, name: claims.name };
  return <Tasks profile={profile} />;
}
