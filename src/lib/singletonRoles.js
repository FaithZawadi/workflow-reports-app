import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { SINGLETON_ROLES } from "@/lib/roles";
import { ROLE_LABEL } from "@/lib/theme";

// The roles a user row effectively holds (the multi-role array, or the legacy
// single `role` when the array is empty).
const rowRoles = (u) => (u && u.roles && u.roles.length ? u.roles : u && u.role ? [u.role] : []);

// Active users — other than `exceptUserId` — who already hold a single-office
// role (CFO / Managing Director) that `roles` would grant. Returns
// [{ role, roleLabel, holderId, holderName, holderEmail }].
export async function findSingletonConflicts(roles, exceptUserId) {
  const wanted = [...new Set(roles || [])].filter((r) => SINGLETON_ROLES.includes(r));
  if (!wanted.length) return [];
  const where = { active: true, AND: [{ OR: [{ roles: { hasSome: wanted } }, { role: { in: wanted } }] }] };
  if (exceptUserId) where.AND.push({ NOT: { id: exceptUserId } });
  const holders = await prisma.user.findMany({ where, select: { id: true, name: true, email: true, roles: true, role: true } });
  const conflicts = [];
  for (const r of wanted) {
    const h = holders.find((u) => rowRoles(u).includes(r));
    if (h) conflicts.push({ role: r, roleLabel: ROLE_LABEL[r] || r, holderId: h.id, holderName: h.name, holderEmail: h.email });
  }
  return conflicts;
}

// Reassign the single-office roles in `roles` to the user being saved: strip each
// from its current holder so only one person ends up holding it. Every removal is
// written to the audit log. Throws a conflict (err.status 409) if a current
// holder has no other role — the admin must give them another role or deactivate
// them first, so the "at least one role" rule is never broken.
export async function reassignSingletonRoles({ roles, exceptUserId, actor }) {
  const conflicts = await findSingletonConflicts(roles, exceptUserId);
  for (const c of conflicts) {
    const holder = await prisma.user.findUnique({ where: { id: c.holderId }, select: { id: true, name: true, email: true, roles: true, role: true } });
    if (!holder) continue;
    const remaining = rowRoles(holder).filter((r) => r !== c.role);
    if (remaining.length === 0) {
      const e = new Error(`${c.holderName} currently holds the ${c.roleLabel} office and has no other role. Give them another role or deactivate them before reassigning ${c.roleLabel}.`);
      e.status = 409;
      throw e;
    }
    await prisma.user.update({ where: { id: holder.id }, data: { roles: remaining, role: remaining[0] } });
    await recordAudit({
      actor,
      action: "UPDATE",
      entity: "USER",
      entityId: holder.id,
      summary: `${c.roleLabel} office reassigned away from ${holder.name} <${holder.email}>`,
    });
  }
  return conflicts;
}
