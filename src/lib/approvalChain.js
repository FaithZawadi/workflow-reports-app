// Per-template approval chains. A stage names the ROLE that may act plus the
// labels shown to users. Templates not listed here use the default email-routed
// supervisor/manager chain with no role lock (unchanged behaviour).
//
// The two report stages are still called SUPERVISOR (first) and MANAGER
// (second) internally; a chain simply pins each stage to a required role and
// relabels it. Example: the Technical Report is reviewed by a Technical Manager,
// then approved by a Project Manager.
// Reports now use a single manager-review stage with no role-locked two-step
// chain. Any routed manager (TM/PM) may approve, so no template pins specific
// roles to stages. Kept as an (empty) map so the helpers below stay valid and a
// chain can be reintroduced later if ever needed.
export const APPROVAL_CHAINS = {};

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
