import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    await requireUser();
  } catch (res) {
    return res;
  }
  const clients = await prisma.client.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return Response.json({ clients });
}

export async function POST(req) {
  let user;
  try {
    user = await requireUser(["ADMIN", "ENGINEER", "PROJECT_MANAGER", "TECHNICAL_MANAGER"]);
  } catch (res) {
    return res;
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return Response.json({ error: "Enter a client name." }, { status: 400 });
  const client = await prisma.client.upsert({
    where: { name },
    create: { name },
    update: {},
    select: { id: true, name: true },
  });
  return Response.json({ client });
}
