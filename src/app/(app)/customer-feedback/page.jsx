import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canManageProjects } from "@/lib/roles";
import ServiceFeedbackList from "@/components/ServiceFeedbackList";

export const metadata = { title: "Customer feedback · QSL Reports" };

export default async function CustomerFeedbackPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canManageProjects(claims)) redirect("/overview");
  return <ServiceFeedbackList />;
}
