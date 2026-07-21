// Central role groupings and access helpers, shared by API routes and UI so the
// rules stay in one place.
//
// A user may hold MORE THAN ONE role. Everywhere that used to take a single
// `role` string now accepts a user/claims object, a role string, or an array of
// roles — access is granted when ANY of the user's roles qualifies.

export const MANAGER_ROLES = ["MANAGER", "PROJECT_MANAGER", "TECHNICAL_MANAGER"];

// Roles allowed to open the Users tab and manage staff.
export const USER_ADMIN_ROLES = ["ADMIN", ...MANAGER_ROLES];

// Everyone who may file a report (technicians, engineers, and now supervisors
// and managers who can also file any form type in addition to approving).
export const FILER_ROLES = [
  "TECHNICIAN",
  "ENGINEER",
  "SUPERVISOR",
  "MANAGER",
  "PROJECT_MANAGER",
  "TECHNICAL_MANAGER",
  "ADMIN",
];

// Roles allowed to create / edit maintenance schedules.
export const SCHEDULE_MANAGER_ROLES = [
  "ADMIN",
  "PROJECT_MANAGER",
  "TECHNICAL_MANAGER",
  "SUPERVISOR",
  "MANAGER",
];

// The staff roles a non-admin manager may create or edit (never admins or other
// managers).
export const MANAGER_ASSIGNABLE_ROLES = ["TECHNICIAN", "ENGINEER", "SUPERVISOR"];

export const ALL_ROLES = [
  "TECHNICIAN",
  "ENGINEER",
  "SUPERVISOR",
  "MANAGER",
  "PROJECT_MANAGER",
  "TECHNICAL_MANAGER",
  "ADMIN",
  "CLIENT",
  "HR",
];

// Human Resources (and admins) record and review training feedback.
export const TRAINING_ROLES = ["HR", "ADMIN"];

// Only the Project Manager and Technical Manager prepare quotations and review
// calibration requests on the QSL side.
export const QUOTE_ROLES = ["PROJECT_MANAGER", "TECHNICAL_MANAGER"];

// Normalize whatever we're given (a claims/user object, a single role string, or
// an array of roles) into a de-duplicated array of role strings.
export function rolesOf(input) {
  if (!input) return [];
  if (typeof input === "string") return [input];
  if (Array.isArray(input)) return [...new Set(input.filter(Boolean))];
  const list = Array.isArray(input.roles) && input.roles.length ? input.roles : input.role ? [input.role] : [];
  return [...new Set(list.filter(Boolean))];
}

const intersects = (input, group) => rolesOf(input).some((r) => group.includes(r));

export const canManageUsers = (input) => intersects(input, USER_ADMIN_ROLES);
export const canFileReports = (input) => intersects(input, FILER_ROLES);
export const canManageSchedulesRole = (input) => intersects(input, SCHEDULE_MANAGER_ROLES);

// CLIENT — a restricted portal login. A client contact files calibration
// requests and requests quotations, and sees only their own records.
export const isClient = (input) => rolesOf(input).includes("CLIENT");
// A user who ONLY holds the CLIENT role sees the restricted client portal (no
// staff tools). Someone who is also staff keeps the full app.
export const isClientOnly = (input) => {
  const roles = rolesOf(input);
  return roles.length > 0 && roles.every((r) => r === "CLIENT");
};

// Who prepares/reviews quotations and calibration requests on the QSL side.
export const canPrepareQuotes = (input) => intersects(input, QUOTE_ROLES);
// Who may open the Quotations / Calibration-requests area at all: the QSL
// preparers (PM/TM) and the clients (who see only their own). No other role.
export const canSeeQuotations = (input) => intersects(input, QUOTE_ROLES) || isClient(input);

// Roles allowed to create/assign tasks and register projects.
export const TASK_MANAGER_ROLES = SCHEDULE_MANAGER_ROLES;
export const canManageTasks = (input) => intersects(input, TASK_MANAGER_ROLES);

// HR (and admins) record and review training feedback.
export const canManageTraining = (input) => intersects(input, TRAINING_ROLES);

// Which target roles an actor may assign when creating/editing a user.
export function assignableRoles(actor) {
  const roles = rolesOf(actor);
  if (roles.includes("ADMIN")) return ALL_ROLES;
  if (roles.some((r) => MANAGER_ROLES.includes(r))) return MANAGER_ASSIGNABLE_ROLES;
  return [];
}

// Whether an actor may create/edit/deactivate a user who holds `target` role(s).
// A manager may only touch a user whose roles are ALL within the roles a manager
// is allowed to assign (so they can't manage admins or other managers).
export function canActOnUserRole(actor, target) {
  const roles = rolesOf(actor);
  const targets = rolesOf(target);
  if (roles.includes("ADMIN")) return true;
  if (roles.some((r) => MANAGER_ROLES.includes(r)))
    return targets.length > 0 && targets.every((t) => MANAGER_ASSIGNABLE_ROLES.includes(t));
  return false;
}
