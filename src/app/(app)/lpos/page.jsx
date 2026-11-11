import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canSeeLpos } from "@/lib/roles";
import Lpos from "@/components/Lpos";

export const metadata = { title: "Purchase orders · QSL" };

export default async function LposPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canSeeLpos(claims)) redirect("/dashboard");
  return <Lpos profile={{ role: claims.role, roles: claims.roles, name: claims.name }} />;
}
