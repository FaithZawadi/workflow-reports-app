// Central role groupings and access helpers, shared by API routes and UI so the
// rules stay in one place.

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
];

export const canManageUsers = (role) => USER_ADMIN_ROLES.includes(role);
export const canFileReports = (role) => FILER_ROLES.includes(role);
export const canManageSchedulesRole = (role) => SCHEDULE_MANAGER_ROLES.includes(role);

// Which target roles an actor may assign when creating/editing a user.
export function assignableRoles(actorRole) {
  if (actorRole === "ADMIN") return ALL_ROLES;
  if (MANAGER_ROLES.includes(actorRole)) return MANAGER_ASSIGNABLE_ROLES;
  return [];
}

// Whether an actor may create/edit/deactivate a user who holds `targetRole`.
export function canActOnUserRole(actorRole, targetRole) {
  if (actorRole === "ADMIN") return true;
  if (MANAGER_ROLES.includes(actorRole)) return MANAGER_ASSIGNABLE_ROLES.includes(targetRole);
  return false;
}
