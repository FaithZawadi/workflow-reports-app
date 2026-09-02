import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { canApproveClients } from "@/lib/roles";
import { notifyUsers } from "@/lib/notify";

export const dynamic = "force-dynamic";

// POST /api/clients/[id]/approve — the chosen approver (or an admin) approves or
// rejects a technician-registered client. Body: { decision: "approve"|"reject", note }.
export async function POST(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }

  const client = await prisma.client.findUnique({ where: { id: params.id } });
  if (!client) return Response.json({ error: "Client not found." }, { status: 404 });

  // Any approver (admin / manager / PM / TM) may decide — not just the one the
  // technician happened to route it to.
  if (!canApproveClients(user)) return Response.json({ error: "Only an approver can act on this." }, { status: 403 });
  if (client.approvalStatus !== "PENDING") return Response.json({ error: "This client has already been decided." }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const approve = b.decision === "approve";
  const note = String(b.note || "").trim() || null;

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: {
      approvalStatus: approve ? "APPROVED" : "REJECTED",
      approvedAt: new Date(),
      approvalNote: note,
      // A rejected registration is deactivated so it drops out of the pickers.
      ...(approve ? {} : { active: false }),
    },
  });

  await recordAudit({
    actor: user,
    action: "UPDATE",
    entity: "CLIENT",
    entityId: client.id,
    summary: `Client ${client.name} ${approve ? "approved" : "rejected"} by ${user.name}${note ? ` — ${note}` : ""}`,
  });

  // Tell whoever registered it what happened.
  if (client.registeredById) {
    try {
      await notifyUsers([client.registeredById], {
        type: approve ? "DECISION" : "FAILURE",
        title: `Client ${approve ? "approved" : "rejected"} · ${client.name}`,
        body: approve
          ? `${user.name} approved the client you registered.`
          : `${user.name} rejected ${client.name}${note ? `: ${note}` : ""}.`,
        link: "/dashboard",
      });
    } catch {
      /* best-effort */
    }
  }

  return Response.json({ ok: true, approvalStatus: updated.approvalStatus });
}
