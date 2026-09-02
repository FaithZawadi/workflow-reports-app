import { TEMPLATES } from "./templates";

// The diverse set of schedulable activities. A form activity maps to a report
// template (so filing it opens the right form); a generic activity is
// free-standing (maintenance, calibration, inspection, …) and just organises the
// schedule and its assignable sub-tasks.
const GENERIC = [
  { key: "MAINTENANCE", label: "Maintenance", template: null },
  { key: "CALIBRATION", label: "Calibration", template: null },
  { key: "SERVICE", label: "Service", template: null },
  { key: "INSPECTION", label: "Inspection", template: null },
  { key: "REPAIR", label: "Repair", template: null },
  { key: "INSTALLATION", label: "Installation", template: null },
  { key: "OTHER", label: "Other activity", template: null },
];

// Groups for the dropdown (form activities first, then generic ones).
export function activityGroups() {
  const forms = TEMPLATES.filter((t) => !t.hidden).map((t) => ({
    key: t.code,
    label: `${t.code} — ${t.name}`,
    template: t.code,
    needsWeighbridge: /^WB/i.test(t.code),
  }));
  return [
    { group: "Report forms", items: forms },
    { group: "General activities", items: GENERIC.map((g) => ({ ...g, needsWeighbridge: false })) },
  ];
}

export function allActivities() {
  return activityGroups().flatMap((g) => g.items);
}

export function activityByKey(key) {
  return allActivities().find((a) => a.key === key) || null;
}
