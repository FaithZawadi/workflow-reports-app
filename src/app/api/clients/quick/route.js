import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { canFileReports, canApproveClients } from "@/lib/roles";
import { resolveSiteByName } from "@/lib/clientResolve";
import { siteDetailData } from "@/lib/clientFields";
import { notifyUsers } from "@/lib/notify";

export const dynamic = "force-dynamic";

// POST /api/clients/quick — a technician adds a brand-new client (and optional
// site) while filing a report, without any other admin access. The client must
// be NEW: if one already exists with that name in ANY casing, we refuse and
// point them at the existing record instead of creating a duplicate.
//
// A client added by a technician/engineer is PENDING and routed to the chosen
// approval manager; one added by an admin/PM/TM is approved outright.
export async function POST(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canFileReports(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  if (!name) return Response.json({ error: "Enter the new client's name." }, { status: 400 });

  // Only-new rule: reject a case-insensitive match against any existing client.
  const clash = await prisma.client.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (clash) {
    return Response.json(
      { error: `“${clash.name}” already exists — pick it from the client list instead of adding it again.`, existing: { id: clash.id, name: clash.name } },
      { status: 409 }
    );
  }

  // Approval routing. Managers/admins register directly; others need a chosen
  // approver and the client stays PENDING until that manager approves it.
  const selfApproves = canApproveClients(user);
  let approverId = String(b.approverId || "").trim() || null;
  let approver = null;
  if (!selfApproves) {
    if (!approverId) return Response.json({ error: "Choose an approval manager for the new client." }, { status: 400 });
    approver = await prisma.user.findFirst({ where: { id: approverId, active: true }, select: { id: true, name: true, email: true } });
    if (!approver || !canApproveClients(approver)) return Response.json({ error: "That approver can't approve clients." }, { status: 400 });
  } else {
    approverId = null;
  }

  const client = await prisma.client.create({
    data: {
      name,
      approvalStatus: selfApproves ? "APPROVED" : "PENDING",
      approverId,
      registeredById: user.sub,
      registeredByName: user.name,
      approvedAt: selfApproves ? new Date() : null,
    },
    select: { id: true, name: true, approvalStatus: true },
  });
  await recordAudit({
    actor: user,
    action: "CREATE",
    entity: "CLIENT",
    entityId: client.id,
    summary: selfApproves
      ? `Client ${client.name} added by ${user.name} while filing a report`
      : `Client ${client.name} registered by ${user.name} — pending approval by ${approver?.name || "manager"}`,
  });

  // Optional site for the new client (with any GPS / geofence details).
  let site = null;
  const siteName = String(b.site || "").trim();
  if (siteName) {
    let s = await resolveSiteByName(client.id, siteName);
    const detail = siteDetailData(b);
    if (Object.keys(detail).length) s = await prisma.site.update({ where: { id: s.id }, data: detail });
    site = s.name;
    await recordAudit({ actor: user, action: "CREATE", entity: "SITE", entityId: s.id, summary: `Site ${s.name} added under ${client.name} by ${user.name}` });
  }

  // Notify the chosen approver that a client is awaiting their approval.
  if (!selfApproves && approver) {
    try {
      await notifyUsers([approver.id], {
        type: "APPROVAL",
        title: `Client approval · ${client.name}`,
        body: `${user.name} registered ${client.name}${site ? ` (${site})` : ""} — approve or reject it.`,
        link: "/clients/pending",
      });
    } catch {
      /* best-effort */
    }
  }

  return Response.json({ client, site });
}
