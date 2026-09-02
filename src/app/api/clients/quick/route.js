import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { canFileReports, canRegisterClientsDirectly } from "@/lib/roles";
import { resolveSiteByName } from "@/lib/clientResolve";
import { siteDetailData, clientDetailData, missingClientFields } from "@/lib/clientFields";
import { notifyApprovers } from "@/lib/approvals";
import { getSettings } from "@/lib/settings";

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
  // Report filers add clients while filing; quotation creators (e.g. Sales) add
  // them while quoting even though they don't file reports.
  if (!canFileReports(user) && !canRegisterClientsDirectly(user))
    return Response.json({ error: "Not allowed." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  if (!name) return Response.json({ error: "Enter the new client's name." }, { status: 400 });

  // A new client must be registered WITH its details — not just a bare name.
  const missing = missingClientFields(b);
  if (missing.length)
    return Response.json({ error: `Add the client's ${missing.join(", ")} before saving.`, missing }, { status: 400 });

  // Only-new rule: reject a case-insensitive match against any existing client.
  const clash = await prisma.client.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (clash) {
    return Response.json(
      { error: `“${clash.name}” already exists — pick it from the client list instead of adding it again.`, existing: { id: clash.id, name: clash.name } },
      { status: 409 }
    );
  }

  // Approval routing. Client approvers (admin/managers/PM/TM) and quotation
  // creators (Sales) register directly; a technician-only user's client stays
  // PENDING for any approver (admin / manager / PM / TM) to confirm — no single
  // approver is chosen. When an admin turns approval off in System Settings,
  // every new client is approved outright regardless of who registered it.
  const settings = await getSettings();
  const approvalRequired = settings.workflow.clientApprovalRequired;
  const selfApproves = !approvalRequired || canRegisterClientsDirectly(user);

  const client = await prisma.client.create({
    data: {
      name,
      ...clientDetailData(b), // contact, address, KRA PIN, etc.
      approvalStatus: selfApproves ? "APPROVED" : "PENDING",
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
      : `Client ${client.name} registered by ${user.name} — pending approval`,
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

  // Tell every approver a client is awaiting approval — any of them may act.
  if (!selfApproves) {
    await notifyApprovers({
      title: `Client approval · ${client.name}`,
      body: `${user.name} registered ${client.name}${site ? ` (${site})` : ""} — approve or reject it.`,
      exceptUserId: user.sub,
    });
  }

  return Response.json({ client, site });
}
