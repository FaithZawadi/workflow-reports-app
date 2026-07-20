import ServiceFeedbackForm from "@/components/ServiceFeedbackForm";

export const metadata = { title: "Customer Satisfaction Survey · Qalibrated Systems" };

// Public page (no login) — customers complete the Customer Satisfaction Survey
// (CSSF) after a calibration. Staff can share a link with the client pre-filled,
// e.g. /service-feedback?client=Kapa%20Oil%20Refineries
export default function ServiceFeedbackPage({ searchParams }) {
  const sp = searchParams || {};
  const prefill = { clientName: typeof sp.client === "string" ? sp.client : "" };
  return <ServiceFeedbackForm prefill={prefill} />;
}
