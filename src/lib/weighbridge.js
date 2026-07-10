// Which weighbridges a user may select when filing/scheduling.
// Admin, engineers and oversight managers see all; technicians see their plant's
// (plus any assigned to them); supervisors/managers see the ones assigned to them.
export function weighbridgeScope(user) {
  const ALL = ["ADMIN", "ENGINEER", "PROJECT_MANAGER", "TECHNICAL_MANAGER"];
  if (ALL.includes(user.role)) return { active: true };
  if (user.role === "TECHNICIAN") {
    const or = [{ users: { some: { id: user.sub } } }];
    if (user.clientId) or.push({ clientId: user.clientId });
    return { active: true, OR: or };
  }
  // SUPERVISOR / MANAGER — the weighbridges assigned to them.
  return { active: true, users: { some: { id: user.sub } } };
}
