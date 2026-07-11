import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { TASK_MANAGER_ROLES, canManageTasks } from "@/lib/roles";

export const dynamic = "force-dynamic";

const shape = (p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  client: p.client?.name || null,
  clientId: p.clientId,
  active: p.active,
  tasks: p._count?.tasks ?? undefined,
});

// GET /api/projects           -> active projects (for dropdowns)
// GET /api/projects?manage=1   -> full list (managers/admin) with task counts
export async function GET(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const { searchParams } = new URL(req.url);

  if (searchParams.get("manage")) {
    if (!canManageTasks(user)) return Response.json({ error: "Not allowed." }, { status: 403 });
    const list = await prisma.project.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { client: { select: { name: true } }, _count: { select: { tasks: true } } },
    });
    return Response.json({ projects: list.map(shape) });
  }

  const list = await prisma.project.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { client: { select: { name: true } } },
  });
  return Response.json({ projects: list.map(shape) });
}

// POST /api/projects — managers/admin register a project.
export async function POST(req) {
  let user;
  try {
    user = await requireUser(TASK_MANAGER_ROLES);
  } catch (res) {
    return res;
  }
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  const clientName = String(b.clientName || "").trim();
  const description = String(b.description || "").trim() || null;
  if (!name) return Response.json({ error: "Project name is required." }, { status: 400 });

  let clientId = null;
  if (clientName) {
    const client = await prisma.client.upsert({ where: { name: clientName }, create: { name: clientName }, update: {} });
    clientId = client.id;
  }
  const p = await prisma.project.create({ data: { name, clientId, description } });
  await recordAudit({
    actor: user,
    action: "CREATE",
    entity: "PROJECT",
    entityId: p.id,
    summary: `Registered project ${name}${clientName ? " for " + clientName : ""}`,
  });
  return Response.json({ project: shape({ ...p, client: clientName ? { name: clientName } : null }) });
}
