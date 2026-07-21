// MMS Training Feedback Form. Participants complete it after training on the
// Qalibrated Systems Maintenance Management System (MMS). Public (shareable) —
// HR reviews the responses and downloads the sheets as PDF.

// Section: Training content, delivery & system understanding — each rated 1..5.
export const TRAINING_CRITERIA = [
  ["t1", "Training objectives were clearly explained."],
  ["t2", "Content covered was relevant to my role."],
  ["t3", "Pace of the training was appropriate."],
  ["t4", "Trainer was knowledgeable and answered questions clearly."],
  ["t5", "Navigating the dashboard (reports, approvals, services due)."],
  ["t6", "Submitting a check with GPS/time-stamped photos."],
  ["t7", "Reviewing & approving reports (email / one-click)."],
  ["t8", "Using the registry & QR verification for records."],
  ["t9", "Requesting quotations/calibrations & uploading an LPO."],
  ["t10", "Using the mobile app, including offline mode."],
  ["t11", "Navigating the desktop dashboard (managers)."],
];
export const TRAINING_CRITERIA_KEYS = TRAINING_CRITERIA.map(([k]) => k);
export const TRAINING_CRITERIA_LABEL = Object.fromEntries(TRAINING_CRITERIA);

// 1..5 scale.
export const TRAINING_SCALE = ["Poor", "Fair", "Good", "Very good", "Excellent"];

// Delivery mode.
export const TRAINING_MODES = [
  { key: "IN_PERSON", label: "In-person" },
  { key: "VIRTUAL", label: "Virtual" },
];
export const TRAINING_MODE_KEYS = TRAINING_MODES.map((m) => m.key);
export const TRAINING_MODE_LABEL = Object.fromEntries(TRAINING_MODES.map((m) => [m.key, m.label]));

// Would you recommend this training to a colleague?
export const RECOMMEND = [
  { key: "YES", label: "Yes" },
  { key: "NO", label: "No" },
  { key: "MAYBE", label: "Maybe" },
];
export const RECOMMEND_KEYS = RECOMMEND.map((r) => r.key);
export const RECOMMEND_LABEL = Object.fromEntries(RECOMMEND.map((r) => [r.key, r.label]));
