import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canFileReports } from "@/lib/roles";
import { assignedClientsFor } from "@/lib/assignments";
import ReportForm from "@/components/ReportForm";

export const metadata = { title: "New report · QSL Reports" };

export default async function NewReportPage({ searchParams }) {
  const claims = await getCurrentUser();
  if (!claims || !canFileReports(claims)) redirect("/dashboard");

  // The client(s) this user is assigned to (serving client, employer, and the
  // clients of any weighbridges they own). Drives the client field for EVERY
  // template — including the Technical Report — and lets a technician assigned
  // to several clients pick one. Prefill only when there's a single assignment.
  const { assignedClients } = await assignedClientsFor(claims.sub);
  const clientName = assignedClients.length === 1 ? assignedClients[0].name : null;

  const profile = {
    role: claims.role,
    roles: claims.roles,
    name: claims.name,
    clientId: claims.clientId,
    clientName,
    assignedClients,
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
