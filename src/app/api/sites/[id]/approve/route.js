import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { canApproveClients } from "@/lib/roles";
import { notifyUsers } from "@/lib/notify";

export const dynamic = "force-dynamic";

// POST /api/sites/[id]/approve — any approver (admin / manager / PM / TM)
// approves or rejects a site a technician added to an existing client.
// Body: { decision: "approve"|"reject", note }.
export async function POST(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canApproveClients(user)) return Response.json({ error: "Only an approver can act on this." }, { status: 403 });

  const site = await prisma.site.findUnique({ where: { id: params.id }, include: { client: { select: { name: true } } } });
  if (!site) return Response.json({ error: "Site not found." }, { status: 404 });
  if (site.approvalStatus !== "PENDING") return Response.json({ error: "This site has already been decided." }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const approve = b.decision === "approve";
  const note = String(b.note || "").trim() || null;

  await prisma.site.update({
    where: { id: site.id },
    data: {
      approvalStatus: approve ? "APPROVED" : "REJECTED",
      approvedAt: new Date(),
      approvalNote: note,
      // A rejected site is deactivated so it drops out of the pickers.
      ...(approve ? {} : { active: false }),
    },
  });

  await recordAudit({
    actor: user,
    action: "UPDATE",
    entity: "SITE",
    entityId: site.id,
    summary: `Site ${site.name} (${site.client?.name || "—"}) ${approve ? "approved" : "rejected"} by ${user.name}${note ? ` — ${note}` : ""}`,
  });

  if (site.registeredById) {
    try {
      await notifyUsers([site.registeredById], {
        type: approve ? "DECISION" : "FAILURE",
        title: `Site ${approve ? "approved" : "rejected"} · ${site.name}`,
        body: approve
          ? `${user.name} approved the site you added to ${site.client?.name || "the client"}.`
          : `${user.name} rejected ${site.name}${note ? `: ${note}` : ""}.`,
        link: "/dashboard",
      });
    } catch {
      /* best-effort */
    }
  }

  return Response.json({ ok: true, approvalStatus: approve ? "APPROVED" : "REJECTED" });
}
