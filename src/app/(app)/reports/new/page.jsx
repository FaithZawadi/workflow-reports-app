import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ReportForm from "@/components/ReportForm";

export const metadata = { title: "New report · QSL Reports" };

export default async function NewReportPage() {
  const claims = await getCurrentUser();
  if (!["TECHNICIAN", "ENGINEER", "ADMIN"].includes(claims.role)) redirect("/dashboard");

  let clientName = null;
  if (claims.clientId) {
    const c = await prisma.client.findUnique({ where: { id: claims.clientId } });
    clientName = c?.name || null;
  }

  const profile = {
    role: claims.role,
    name: claims.name,
    clientId: claims.clientId,
    clientName,
    site: claims.site,
  };
  return <ReportForm profile={profile} />;
}
