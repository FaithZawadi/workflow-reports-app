import { prisma } from "@/lib/db";
import { requireUser, hashPassword } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { USER_ADMIN_ROLES, assignableRoles, canActOnUserRole } from "@/lib/roles";

const rolesOfRow = (u) => (u && u.roles && u.roles.length ? u.roles : u ? [u.role] : []);

// PATCH /api/users/[id] — edit a user: role, active, name, site, phone, client,
// and/or reset password. Users are deactivated, never deleted, so the audit
// trail and authored reports stay intact. Admins may act on anyone; managers
// may only act on the staff roles they are allowed to manage.
export async function PATCH(req, { params }) {
  let admin;
  try {
    admin = await requireUser(USER_ADMIN_ROLES);
  } catch (res) {
    return res;
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return Response.json({ error: "User not found." }, { status: 404 });

  // A manager cannot touch admins or other managers.
  if (!canActOnUserRole(admin, rolesOfRow(target)))
    return Response.json({ error: "You can't manage this user." }, { status: 403 });

  const allowedRoles = assignableRoles(admin);
  const body = await req.json().catch(() => ({}));
  const data = {};

  if (body.roles !== undefined || body.role !== undefined) {
    const roles = [...new Set((Array.isArray(body.roles) ? body.roles : [body.role]).map(String).filter(Boolean))];
    if (roles.length === 0)
      return Response.json({ error: "A user must have at least one role." }, { status: 400 });
    if (!roles.every((r) => allowedRoles.includes(r)))
      return Response.json({ error: "You can't assign that role." }, { status: 400 });
    if (target.id === admin.sub && !(roles.length === 1 && roles[0] === "ADMIN"))
      return Response.json({ error: "You can't change your own role." }, { status: 400 });
    data.roles = roles;
    data.role = roles[0]; // primary role
  }
  if (body.active !== undefined) {
    if (target.id === admin.sub && body.active === false)
      return Response.json({ error: "You can't deactivate your own account." }, { status: 400 });
    data.active = !!body.active;
  }
  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (n) data.name = n;
  }
  if (body.site !== undefined) data.site = String(body.site).trim() || null;
  if (body.phone !== undefined) data.phone = String(body.phone).trim() || null;

  const resolveClient = async (idVal, nameVal) => {
    const id = String(idVal || "").trim();
    if (id) return id;
    const nm = String(nameVal || "").trim();
    if (!nm) return null;
    const c = await prisma.client.upsert({ where: { name: nm }, create: { name: nm }, update: {} });
    return c.id;
  };

  // Home organisation.
  if (body.orgType !== undefined) {
    data.orgType = String(body.orgType).toUpperCase() === "CLIENT" ? "CLIENT" : "QSL";
  }
  // Employer client (their home company). For QSL staff the field is cleared so
  // clientId only ever means the person's employer.
  if (body.clientName !== undefined || body.clientId !== undefined || body.orgType !== undefined) {
    const effOrg = data.orgType || (body.orgType ? undefined : target.orgType) || "QSL";
    if (effOrg === "CLIENT") {
      data.clientId = await resolveClient(body.clientId, body.clientName);
    } else {
      data.clientId = null;
    }
  }
  // Serving / deployed-to client.
  if (body.servingClientId !== undefined || body.servingClientName !== undefined) {
    data.servingClientId = await resolveClient(body.servingClientId, body.servingClientName);
  }
  if (body.newPassword) {
    if (String(body.newPassword).length < 8)
      return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    data.passwordHash = await hashPassword(String(body.newPassword));
    data.passwordChangedAt = new Date(); // reset the 2-month rotation clock
  }
  // Weighbridge assignment (admin only).
  if (body.weighbridgeIds !== undefined && rolesOfRow(admin).includes("ADMIN")) {
    const ids = Array.isArray(body.weighbridgeIds) ? body.weighbridgeIds.map(String) : [];
    data.weighbridges = { set: ids.map((id) => ({ id })) };
  }

  if (Object.keys(data).length === 0)
    return Response.json({ error: "Nothing to update." }, { status: 400 });

  const u = await prisma.user.update({ where: { id: params.id }, data, include: { client: { select: { name: true } }, servingClient: { select: { id: true, name: true } } } });

  const changed = Object.keys(data)
    .map((k) => (k === "passwordHash" ? "password" : k))
    .join(", ");
  await recordAudit({
    actor: admin,
    action: "UPDATE",
    entity: "USER",
    entityId: u.id,
    summary: `Updated ${u.name} <${u.email}> (${changed})`,
  });

  return Response.json({
    user: { id: u.id, email: u.email, name: u.name, role: u.role, roles: rolesOfRow(u), site: u.site, orgType: u.orgType || "QSL", orgName: u.orgType === "CLIENT" ? u.client?.name || "Client" : "Qalibrated Systems", client: u.client?.name || null, servingClientId: u.servingClientId || null, servingClient: u.servingClient?.name || null, active: u.active },
  });
}
