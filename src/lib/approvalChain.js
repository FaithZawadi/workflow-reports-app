// Per-template approval chains. A stage names the ROLE that may act plus the
// labels shown to users. Templates not listed here use the default email-routed
// supervisor/manager chain with no role lock (unchanged behaviour).
//
// The two report stages are still called SUPERVISOR (first) and MANAGER
// (second) internally; a chain simply pins each stage to a required role and
// relabels it. Example: the Technical Report is reviewed by a Technical Manager,
// then approved by a Project Manager.
export const APPROVAL_CHAINS = {
  TR01: {
    SUPERVISOR: { role: "TECHNICAL_MANAGER", label: "Technical Manager", short: "TECHNICAL MANAGER REVIEW" },
    MANAGER: { role: "PROJECT_MANAGER", label: "Project Manager", short: "PROJECT MANAGER APPROVAL" },
  },
};

export function chainFor(template) {
  return APPROVAL_CHAINS[template] || null;
}

// The role required to act at a stage for this template, or null if unlocked.
export function stageRole(template, stage) {
  return APPROVAL_CHAINS[template]?.[stage]?.role || null;
}

// The human label for a stage ("Technical Manager"), or null if unlocked.
export function stageLabel(template, stage) {
  return APPROVAL_CHAINS[template]?.[stage]?.label || null;
}
