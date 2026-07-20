// Customer Satisfaction Survey Form (QSL/QP/004/CSSF). Structure mirrors the
// ISO/IEC 17025:2017 survey used for NAWI and Mass Standards calibration.

export const SURVEY_SERVICE_TYPES = [
  { key: "WEIGHBRIDGE", label: "Weighbridge Calibration" },
  { key: "BALANCE", label: "Weighing Balance Calibration" },
  { key: "MASS_STANDARDS", label: "Mass Standards Calibration" },
];
export const SURVEY_SERVICE_KEYS = SURVEY_SERVICE_TYPES.map((s) => s.key);
export const SURVEY_SERVICE_LABEL = Object.fromEntries(SURVEY_SERVICE_TYPES.map((s) => [s.key, s.label]));

// Section 2 — evaluation criteria, each rated 1..5.
export const SURVEY_CRITERIA = [
  ["2.1", "Ease of communication with our staff"],
  ["2.2", "Technical competence of our personnel"],
  ["2.3", "Understanding of your calibration requirements"],
  ["2.4", "Adherence to agreed scope of works"],
  ["2.5", "Responsiveness"],
  ["2.6", "Turnaround time / delivery of service"],
  ["2.7", "Handling and care of your instruments / weights"],
  ["2.8", "Traceability to national / international standards"],
  ["2.9", "Compliance with regulatory / accreditation requirements"],
  ["2.10", "Overall quality of calibration service"],
];
export const SURVEY_CRITERIA_KEYS = SURVEY_CRITERIA.map(([k]) => k);

// 1..5 satisfaction scale.
export const SATISFACTION_SCALE = ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"];

// Section 4.2 — how a complaint was handled.
export const COMPLAINT_HANDLING = [
  { key: "NA", label: "Not applicable" },
  { key: "VERY_UNSATISFACTORY", label: "Very unsatisfactory" },
  { key: "UNSATISFACTORY", label: "Unsatisfactory" },
  { key: "NEUTRAL", label: "Neutral" },
  { key: "SATISFACTORY", label: "Satisfactory" },
  { key: "VERY_SATISFACTORY", label: "Very satisfactory" },
];
export const COMPLAINT_HANDLING_LABEL = Object.fromEntries(COMPLAINT_HANDLING.map((s) => [s.key, s.label]));

// Section 6 — yes / no / not sure.
export const YES_NO_UNSURE = [
  { key: "YES", label: "Yes" },
  { key: "NO", label: "No" },
  { key: "NOT_SURE", label: "Not sure" },
];
export const YES_NO_UNSURE_KEYS = YES_NO_UNSURE.map((s) => s.key);
