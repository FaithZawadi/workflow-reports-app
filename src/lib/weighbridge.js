import { rolesOf } from "./roles";
import { prisma } from "./db";

// Validate a chosen Client/Manager for a weighbridge: must be an active user
// holding the MANAGER role. Returns the id, or null (to clear / when invalid).
export async function resolveManagerId(value) {
  const id = String(value || "").trim();
  if (!id) return null;
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, active: true, role: true, roles: true } });
  if (!u || !u.active) return null;
  const roles = u.roles && u.roles.length ? u.roles : [u.role];
  return roles.includes("MANAGER") ? u.id : null;
}

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
