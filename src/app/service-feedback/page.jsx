import ServiceFeedbackForm from "@/components/ServiceFeedbackForm";
import { SERVICE_TYPE_KEYS } from "@/lib/serviceTypes";

export const metadata = { title: "Service feedback · Qalibrated Systems" };

// Public page (no login) — customers leave feedback / an enquiry after a
// service. Staff can share a tailored link, e.g.
//   /service-feedback?service=QUARTERLY_SERVICE&client=TATA%20Chemicals%20Magadi
export default function ServiceFeedbackPage({ searchParams }) {
  const sp = searchParams || {};
  const svc = typeof sp.service === "string" && SERVICE_TYPE_KEYS.includes(sp.service) ? sp.service : "";
  const prefill = { serviceType: svc, clientName: typeof sp.client === "string" ? sp.client : "" };
  return <ServiceFeedbackForm prefill={prefill} />;
}
