import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canApproveClients } from "@/lib/roles";
import ClientApprovals from "@/components/ClientApprovals";

export const metadata = { title: "Client approvals · QSL Reports" };

export default async function ClientApprovalsPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  // Only managers / PM / TM / admins approve technician-registered clients.
  if (!canApproveClients(claims)) redirect("/dashboard");
  return <ClientApprovals />;
}
