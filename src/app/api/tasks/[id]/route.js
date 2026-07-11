import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { canManageTasks } from "@/lib/roles";

const VALID_STATUS = ["OPEN", "IN_PROGRESS", "BLOCKED", "DONE"];
const norm = (v) => (v || "").trim().toLowerCase();

// PATCH /api/tasks/[id] — managers/admin may edit anything; the assignee may
// update the status of their own task (to track progress to completion).
export async function PATCH(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) return Response.json({ error: "Task not found." }, { status: 404 });

  const manage = canManageTasks(user);
  const isAssignee = task.assignedToId === user.sub || (task.assignedEmail && norm(task.assignedEmail) === norm(user.email));
  if (!manage && !isAssignee) return Response.json({ error: "You can't update this task." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const data = {};

  if (b.status !== undefined) {
    if (!VALID_STATUS.includes(b.status)) return Response.json({ error: "Invalid status." }, { status: 400 });
    data.status = b.status;
    data.doneAt = b.status === "DONE" ? new Date() : null;
  }

  // Only managers may re-scope / reassign a task.
  if (manage) {
    if (b.title !== undefined) {
      const tt = String(b.title).trim();
      if (!tt) return Response.json({ error: "Title can't be empty." }, { status: 400 });
      data.title = tt;
    }
    if (b.description !== undefined) data.description = String(b.description).trim() || null;
    if (b.priority !== undefined) data.priority = ["LOW", "MEDIUM", "HIGH"].includes(b.priority) ? b.priority : null;
    if (b.projectId !== undefined) data.projectId = b.projectId || null;
    if (b.weighbridgeId !== undefined) data.weighbridgeId = String(b.weighbridgeId).trim() || null;
    if (b.dueAt !== undefined) {
      const d = b.dueAt ? new Date(b.dueAt) : null;
      data.dueAt = d && !isNaN(d) ? d : null;
    }
    if (b.clientName !== undefined) {
      const cn = String(b.clientName).trim();
      if (cn) {
        const c = await prisma.client.upsert({ where: { name: cn }, create: { name: cn }, update: {} });
        data.clientId = c.id;
        data.clientName = cn;
      } else {
        data.clientId = null;
        data.clientName = null;
      }
    }
    if (b.assignedEmail !== undefined) {
      const email = String(b.assignedEmail).trim().toLowerCase();
      if (email) {
        const a = await prisma.user.findUnique({ where: { email } });
        data.assignedEmail = email;
        data.assignedToId = a ? a.id : null;
        data.assignedName = a ? a.name : String(b.assignedName || "").trim() || null;
      } else {
        data.assignedEmail = null;
        data.assignedToId = null;
        data.assignedName = null;
      }
    }
  }

  if (Object.keys(data).length === 0)
    return Response.json({ error: "Nothing to update." }, { status: 400 });

  const t = await prisma.task.update({ where: { id: params.id }, data });
  await recordAudit({
    actor: user,
    action: "UPDATE",
    entity: "TASK",
    entityId: t.id,
    summary: `Updated task "${t.title}"${data.status ? " → " + data.status : ""}`,
  });
  return Response.json({ ok: true });
}

// DELETE /api/tasks/[id] — managers/admin only.
export async function DELETE(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canManageTasks(user)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) return Response.json({ error: "Task not found." }, { status: 404 });
  await prisma.task.delete({ where: { id: params.id } });
  await recordAudit({ actor: user, action: "DELETE", entity: "TASK", entityId: task.id, summary: `Deleted task "${task.title}"` });
  return Response.json({ ok: true });
}
