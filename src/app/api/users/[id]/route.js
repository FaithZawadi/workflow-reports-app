import { prisma } from "@/lib/db";
import { requireUser, hashPassword } from "@/lib/auth";

const ROLES = [
  "TECHNICIAN",
  "ENGINEER",
  "SUPERVISOR",
  "MANAGER",
  "PROJECT_MANAGER",
  "TECHNICAL_MANAGER",
  "ADMIN",
];

// PATCH /api/users/[id] — admin edits a user: role, active, name, site, phone,
// client, and/or reset password. Users are deactivated, never deleted, so the
// audit trail and authored reports stay intact.
export async function PATCH(req, { params }) {
  let admin;
  try {
    admin = await requireUser(["ADMIN"]);
  } catch (res) {
    return res;
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return Response.json({ error: "User not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data = {};

  if (body.role !== undefined) {
    if (!ROLES.includes(body.role))
      return Response.json({ error: "Invalid role." }, { status: 400 });
    if (target.id === admin.sub && body.role !== "ADMIN")
      return Response.json({ error: "You can't change your own role." }, { status: 400 });
    data.role = body.role;
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
  if (body.clientName !== undefined) {
    const cn = String(body.clientName).trim();
    if (cn) {
      const c = await prisma.client.upsert({ where: { name: cn }, create: { name: cn }, update: {} });
      data.clientId = c.id;
    } else {
      data.clientId = null;
    }
  }
  if (body.newPassword) {
    if (String(body.newPassword).length < 8)
      return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    data.passwordHash = await hashPassword(String(body.newPassword));
  }

  if (Object.keys(data).length === 0)
    return Response.json({ error: "Nothing to update." }, { status: 400 });

  const u = await prisma.user.update({ where: { id: params.id }, data, include: { client: { select: { name: true } } } });
  return Response.json({
    user: { id: u.id, email: u.email, name: u.name, role: u.role, site: u.site, client: u.client?.name || null, active: u.active },
  });
}
