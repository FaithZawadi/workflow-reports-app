import Welcome from "@/components/Welcome";

// The public landing page. Authenticated visitors are redirected to the
// dashboard by middleware, so this only greets logged-out visitors.
export const metadata = {
  title: "Qalibrated Systems — Weighbridge & Scale Maintenance Management",
  description:
    "Qalibrated Systems: digital weighbridge & scale inspections, ISO/IEC 17025 calibration records, approvals, scheduling and branded PDF reports — on the web and installable on your phone.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Qalibrated Systems — Maintenance Management System",
    description:
      "Digital inspections, ISO/IEC 17025 calibration records, approvals, scheduling and branded reports.",
    url: "/",
  },
};

export default function Home() {
  return <Welcome />;
}
