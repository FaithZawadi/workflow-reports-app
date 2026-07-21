import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canManageTraining } from "@/lib/roles";
import TrainingFeedback from "@/components/TrainingFeedback";

export const metadata = { title: "Training feedback · QSL" };

export default async function TrainingFeedbackPage() {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  if (!canManageTraining(claims)) redirect("/overview");
  return <TrainingFeedback />;
}
