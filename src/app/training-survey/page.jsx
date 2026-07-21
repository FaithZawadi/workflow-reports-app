import TrainingFeedbackForm from "@/components/TrainingFeedbackForm";

export const metadata = { title: "Training Feedback Form · Qalibrated Systems" };

// Public page (no login) — participants complete the MMS Training Feedback Form
// after a training. HR can share a pre-filled link, e.g.
// /training-survey?org=Tata%20Chemicals&trainer=Zawadi&date=2026-07-21
export default function TrainingSurveyPage({ searchParams }) {
  const sp = searchParams || {};
  const str = (v) => (typeof v === "string" ? v : "");
  const prefill = {
    organization: str(sp.org),
    trainer: str(sp.trainer),
    date: str(sp.date),
    trainingTitle: str(sp.title),
  };
  return <TrainingFeedbackForm prefill={prefill} />;
}
