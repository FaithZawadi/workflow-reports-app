import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { rolesOf } from "@/lib/roles";
import FeedbackList from "@/components/FeedbackList";

export const metadata = { title: "Feedback · QSL Reports" };

export default async function FeedbackPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!rolesOf(claims).includes("ADMIN")) redirect("/dashboard");
  return <FeedbackList />;
}
