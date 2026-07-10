import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import WeighbridgesAdmin from "@/components/WeighbridgesAdmin";

export const metadata = { title: "Weighbridges · QSL Reports" };

export default async function WeighbridgesPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (claims.role !== "ADMIN") redirect("/dashboard");
  return <WeighbridgesAdmin />;
}
