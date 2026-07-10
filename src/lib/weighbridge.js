import { rolesOf } from "./roles";

// Which weighbridges a user may select when filing/scheduling.
// Admin, engineers and oversight managers see all; technicians see their plant's
// (plus any assigned to them); supervisors/managers see the ones assigned to them.
// A user with several roles gets the UNION of what each role allows.
export function weighbridgeScope(user) {
  const roles = rolesOf(user);
  const ALL = ["ADMIN", "ENGINEER", "PROJECT_MANAGER", "TECHNICAL_MANAGER"];
  if (roles.some((r) => ALL.includes(r))) return { active: true };

  // Technicians, supervisors and managers: the weighbridges assigned to them,
  // plus (for technicians) any at their plant.
  const or = [{ users: { some: { id: user.sub } } }];
  if (roles.includes("TECHNICIAN") && user.clientId) or.push({ clientId: user.clientId });
  return { active: true, OR: or };
}
