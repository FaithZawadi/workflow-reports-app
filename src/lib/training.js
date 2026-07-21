// Training Feedback / Evaluation form. HR records one per attendee after a
// training session and can download each as a PDF sheet.

// Evaluation criteria, each rated 1..5.
export const TRAINING_CRITERIA = [
  ["t1", "Relevance of the training to your role"],
  ["t2", "Clarity of the content and materials"],
  ["t3", "Knowledge and delivery of the facilitator"],
  ["t4", "Pace and duration of the session"],
  ["t5", "Opportunity to ask questions / practise"],
  ["t6", "Usefulness of the app walkthrough"],
  ["t7", "Overall value of the training"],
];
export const TRAINING_CRITERIA_KEYS = TRAINING_CRITERIA.map(([k]) => k);
export const TRAINING_CRITERIA_LABEL = Object.fromEntries(TRAINING_CRITERIA);

// 1..5 scale (shared wording with the customer survey).
export const TRAINING_SCALE = ["Poor", "Fair", "Good", "Very good", "Excellent"];

// Would you recommend this training?
export const RECOMMEND = [
  { key: "YES", label: "Yes" },
  { key: "NO", label: "No" },
  { key: "NOT_SURE", label: "Not sure" },
];
export const RECOMMEND_KEYS = RECOMMEND.map((r) => r.key);
export const RECOMMEND_LABEL = Object.fromEntries(RECOMMEND.map((r) => [r.key, r.label]));
