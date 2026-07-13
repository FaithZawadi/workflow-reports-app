import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { TASK_MANAGER_ROLES, canManageTasks } from "@/lib/roles";
import { notifyUsers } from "@/lib/notify";

export const dynamic = "force-dynamic";

const shape = (t) => ({
  id: t.id,
  title: t.title,
  description: t.description,
  status: t.status,
  priority: t.priority,
  projectId: t.projectId,
  project: t.project?.name || null,
  clientId: t.clientId,
  clientName: t.clientName || t.client?.name || null,
  weighbridgeId: t.weighbridgeId,
  assignedName: t.assignedName,
  assignedEmail: t.assignedEmail,
  assignedToId: t.assignedToId,
  createdName: t.createdName,
  dueAt: t.dueAt,
  doneAt: t.doneAt,
  createdAt: t.createdAt,
});

// GET /api/tasks — managers/admin see all; everyone else sees tasks assigned to
// them (matched by id or email).
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const where = canManageTasks(user)
    ? {}
    : { OR: [{ assignedToId: user.sub }, { assignedEmail: { equals: user.email, mode: "insensitive" } }] };

  const list = await prisma.task.findMany({
    where,
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    include: { project: { select: { name: true } }, client: { select: { name: true } } },
  });
  return Response.json({ tasks: list.map(shape), canManage: canManageTasks(user) });
}

// POST /api/tasks — managers/admin create and assign a task.
export async function POST(req) {
  let user;
  try {
    user = await requireUser(TASK_MANAGER_ROLES);
  } catch (res) {
    return res;
  }
  const b = await req.json().catch(() => ({}));
  const title = String(b.title || "").trim();
  if (!title) return Response.json({ error: "A task title is required." }, { status: 400 });

  const clientName = String(b.clientName || "").trim();
  let clientId = null;
  if (clientName) {
    const c = await prisma.client.upsert({ where: { name: clientName }, create: { name: clientName }, update: {} });
    clientId = c.id;
  }

  // Resolve the assignee against the directory so we store a clean snapshot.
  let assignedToId = null;
  const assignedEmail = String(b.assignedEmail || "").trim().toLowerCase();
  let assignedName = String(b.assignedName || "").trim() || null;
  if (assignedEmail) {
    const a = await prisma.user.findUnique({ where: { email: assignedEmail } });
    if (a) {
      assignedToId = a.id;
      assignedName = a.name;
    }
  }

  const dueAt = b.dueAt ? new Date(b.dueAt) : null;
  const priority = ["LOW", "MEDIUM", "HIGH"].includes(b.priority) ? b.priority : null;

  const t = await prisma.task.create({
    data: {
      title,
      description: String(b.description || "").trim() || null,
      priority,
      projectId: b.projectId || null,
      clientId,
      clientName: clientName || null,
      weighbridgeId: String(b.weighbridgeId || "").trim() || null,
      assignedToId,
      assignedName,
      assignedEmail: assignedEmail || null,
      createdById: user.sub,
      createdName: user.name,
      dueAt: dueAt && !isNaN(dueAt) ? dueAt : null,
    },
    include: { project: { select: { name: true } }, client: { select: { name: true } } },
  });
  await recordAudit({
    actor: user,
    action: "CREATE",
    entity: "TASK",
    entityId: t.id,
    summary: `Created task "${title}"${assignedName ? " for " + assignedName : ""}`,
  });
  if (assignedToId)
    await notifyUsers([assignedToId], {
      type: "TASK",
      title: "New task assigned to you",
      body: `${title}${clientName ? " — " + clientName : ""}`,
      link: "/tasks",
    });
  return Response.json({ task: shape(t) });
}
