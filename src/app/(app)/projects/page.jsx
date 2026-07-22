import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canManageProjects } from "@/lib/roles";
import ProjectsAdmin from "@/components/ProjectsAdmin";

export const metadata = { title: "Projects · QSL Reports" };

export default async function ProjectsPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canManageProjects(claims)) redirect("/overview");
  return <ProjectsAdmin />;
}
