import { prisma } from "@/lib/db";
import { verifyPassword, startSession } from "@/lib/auth";
import { rolesOf } from "@/lib/roles";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const code = String(body.code || "");

  if (!email || !password) {
    return Response.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { client: true } });
  if (!user || !user.active) {
    return Response.json({ error: "Wrong email or password." }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return Response.json({ error: "Wrong email or password." }, { status: 401 });
  }

  // Oversight roles require the second-factor access code (whether held as a
  // primary or secondary role).
  const heldRoles = rolesOf(user);
  if (heldRoles.includes("PROJECT_MANAGER") && code !== (process.env.PROJECT_MANAGER_CODE || "")) {
    return Response.json({ error: "Project Manager access code is required." }, { status: 401 });
  }
  if (heldRoles.includes("TECHNICAL_MANAGER") && code !== (process.env.TECHNICAL_MANAGER_CODE || "")) {
    return Response.json({ error: "Technical Manager access code is required." }, { status: 401 });
  }

  await startSession(user);

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      roles: user.roles && user.roles.length ? user.roles : [user.role],
      clientId: user.clientId,
      clientName: user.client?.name || null,
      site: user.site,
    },
  });
}
