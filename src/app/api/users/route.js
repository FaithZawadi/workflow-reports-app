import { prisma } from "@/lib/db";
import { requireUser, hashPassword } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { USER_ADMIN_ROLES, MANAGER_ASSIGNABLE_ROLES, ALL_ROLES, assignableRoles, rolesOf } from "@/lib/roles";

const rolesOfRow = (u) => (u.roles && u.roles.length ? u.roles : [u.role]);

export async function GET() {
  let me;
  try {
    me = await requireUser(USER_ADMIN_ROLES);
  } catch (res) {
    return res;
  }
  // Admins see everyone; managers see only the staff they can fully manage —
  // users who have at least one manageable role and none outside it.
  const elevated = ALL_ROLES.filter((r) => !MANAGER_ASSIGNABLE_ROLES.includes(r));
  const where = rolesOf(me).includes("ADMIN")
    ? {}
    : { AND: [{ roles: { hasSome: MANAGER_ASSIGNABLE_ROLES } }, { NOT: { roles: { hasSome: elevated } } }] };
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { client: { select: { name: true } }, weighbridges: { select: { id: true, label: true } } },
  });
  return Response.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      roles: rolesOfRow(u),
      site: u.site,
      client: u.client?.name || null,
      active: u.active,
      weighbridges: u.weighbridges,
    })),
  });
}

export async function POST(req) {
  let me;
  try {
    me = await requireUser(USER_ADMIN_ROLES);
  } catch (res) {
    return res;
  }
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  // Accept a `roles` array (multi-role) or a single `role` for backward compat.
  const roles = [...new Set((Array.isArray(body.roles) ? body.roles : [body.role]).map(String).filter(Boolean))];
  const site = String(body.site || "").trim() || null;
  const clientName = String(body.clientName || "").trim();

  const allowedRoles = assignableRoles(me);
  if (!email || !name || !password || roles.length === 0 || !roles.every((r) => allowedRoles.includes(r)))
    return Response.json(
      { error: "Name, email, password and at least one role you are allowed to assign are required." },
      { status: 400 }
    );
  const role = roles[0]; // primary role
  if (password.length < 8)
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return Response.json({ error: "A user with that email already exists." }, { status: 409 });

  let clientId = null;
  if (clientName) {
    const client = await prisma.client.upsert({
      where: { name: clientName },
      create: { name: clientName },
      update: {},
    });
    clientId = client.id;
  }

  const user = await prisma.user.create({
    data: { email, name, passwordHash: await hashPassword(password), role, roles, site, clientId },
  });
  await recordAudit({
    actor: me,
    action: "CREATE",
    entity: "USER",
    entityId: user.id,
    summary: `Created ${roles.join(", ")} ${name} <${email}>`,
  });
  return Response.json({ user: { id: user.id, email: user.email, role: user.role } });
}
