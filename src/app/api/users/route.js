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

export async function GET() {
  try {
    await requireUser(["ADMIN"]);
  } catch (res) {
    return res;
  }
  const users = await prisma.user.findMany({
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
  try {
    await requireUser(["ADMIN"]);
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

  if (!email || !name || !password || !ROLES.includes(role))
    return Response.json({ error: "Name, email, password and a valid role are required." }, { status: 400 });

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
  return Response.json({ user: { id: user.id, email: user.email, role: user.role } });
}
