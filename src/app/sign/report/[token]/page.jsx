import ExternalReportSign from "@/components/ExternalReportSign";

export const metadata = { title: "Sign report — Qalibrated", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Public, no-login page where a client reviews and signs a report. The token in
// the URL is the capability; the signed copy is stored back in the app.
export default function SignReportPage({ params }) {
  return <ExternalReportSign token={params.token} />;
}
