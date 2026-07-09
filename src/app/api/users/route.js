import { prisma } from "@/lib/db";
import { requireUser, hashPassword } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { USER_ADMIN_ROLES, MANAGER_ASSIGNABLE_ROLES, assignableRoles } from "@/lib/roles";

export async function GET() {
  let me;
  try {
    me = await requireUser(USER_ADMIN_ROLES);
  } catch (res) {
    return res;
  }
  // Admins see everyone; managers see only the staff they can manage.
  const where = me.role === "ADMIN" ? {} : { role: { in: MANAGER_ASSIGNABLE_ROLES } };
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { client: { select: { name: true } } },
  });
  return Response.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      site: u.site,
      client: u.client?.name || null,
      active: u.active,
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
  const role = String(body.role || "");
  const site = String(body.site || "").trim() || null;
  const clientName = String(body.clientName || "").trim();

  const allowedRoles = assignableRoles(me.role);
  if (!email || !name || !password || !allowedRoles.includes(role))
    return Response.json(
      { error: "Name, email, password and a role you are allowed to assign are required." },
      { status: 400 }
    );
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
    data: { email, name, passwordHash: await hashPassword(password), role, site, clientId },
  });
  await recordAudit({
    actor: me,
    action: "CREATE",
    entity: "USER",
    entityId: user.id,
    summary: `Created ${role} ${name} <${email}>`,
  });
  return Response.json({ user: { id: user.id, email: user.email, role: user.role } });
}
