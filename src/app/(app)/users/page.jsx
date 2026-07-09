import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/roles";
import UsersAdmin from "@/components/UsersAdmin";

export const metadata = { title: "Users · QSL Reports" };

export default async function UsersPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canManageUsers(claims.role)) redirect("/dashboard");
  return <UsersAdmin profile={{ id: claims.sub, role: claims.role, name: claims.name }} />;
}
