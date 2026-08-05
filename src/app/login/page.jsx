import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export const metadata = {
  title: "Sign in",
  description:
    "Sign in to Qalibrated Systems — the weighbridge & scale maintenance management platform for digital inspections, ISO/IEC 17025 calibration records, approvals, scheduling and client service statements.",
  alternates: { canonical: "/login" },
  openGraph: {
    title: "Sign in · Qalibrated Systems",
    description: "Weighbridge & scale maintenance management — inspections, calibration records, approvals and reports.",
    url: "/login",
  },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
