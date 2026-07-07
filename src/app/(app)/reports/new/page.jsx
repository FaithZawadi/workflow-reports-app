import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ReportForm from "@/components/ReportForm";

export const metadata = { title: "New report · QSL Reports" };

export default async function NewReportPage({ searchParams }) {
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

  // Prefill when arriving from a maintenance schedule ("File report").
  const sp = searchParams || {};
  const prefill = {
    template: typeof sp.template === "string" ? sp.template : null,
    weighbridgeId: typeof sp.weighbridgeId === "string" ? sp.weighbridgeId : "",
    client: typeof sp.client === "string" ? sp.client : "",
    site: typeof sp.site === "string" ? sp.site : "",
    scheduleId: typeof sp.scheduleId === "string" ? sp.scheduleId : null,
  };

  return <ReportForm profile={profile} prefill={prefill} />;
}
