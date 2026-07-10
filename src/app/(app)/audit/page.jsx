import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { rolesOf } from "@/lib/roles";
import AuditLog from "@/components/AuditLog";

export const metadata = { title: "Audit log · QSL Reports" };

export default async function AuditPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!rolesOf(claims).includes("ADMIN")) redirect("/dashboard");
  return <AuditLog />;
}
