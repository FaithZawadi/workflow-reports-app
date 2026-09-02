import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { canFileReports, canRegisterClientsDirectly } from "@/lib/roles";
import { siteDetailData } from "@/lib/clientFields";
import { notifyApprovers } from "@/lib/approvals";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// POST /api/sites/quick — add a NEW site to an EXISTING client while filing. A
// technician's site stays PENDING for any approver (admin / manager / PM / TM);
// an approver or Sales adds it directly. The site must be new: a case-insensitive
// match under the same client is refused so a site is never double-added.
export async function POST(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canFileReports(user) && !canRegisterClientsDirectly(user))
    return Response.json({ error: "Not allowed." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const clientId = String(b.clientId || "").trim();
  const name = String(b.name || "").trim();
  if (!clientId) return Response.json({ error: "Select the client first." }, { status: 400 });
  if (!name) return Response.json({ error: "Enter the new site's name." }, { status: 400 });

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } });
  if (!client) return Response.json({ error: "That client isn't registered." }, { status: 400 });

  // No double-add: reject a case-insensitive site match under this client.
  const clash = await prisma.site.findFirst({
    where: { clientId, name: { equals: name, mode: "insensitive" }, active: true },
    select: { id: true, name: true },
  });
  if (clash) {
    return Response.json(
      { error: `“${clash.name}” is already a site of ${client.name} — pick it from the list.`, existing: { id: clash.id, name: clash.name } },
      { status: 409 }
    );
  }

  const settings = await getSettings();
  const selfApproves = !settings.workflow.clientApprovalRequired || canRegisterClientsDirectly(user);
  const detail = siteDetailData(b);

  const site = await prisma.site.create({
    data: {
      name,
      clientId,
      approvalStatus: selfApproves ? "APPROVED" : "PENDING",
      registeredById: user.sub,
      registeredByName: user.name,
      approvedAt: selfApproves ? new Date() : null,
      ...detail,
    },
    select: { id: true, name: true, approvalStatus: true },
  });

  await recordAudit({
    actor: user,
    action: "CREATE",
    entity: "SITE",
    entityId: site.id,
    summary: selfApproves
      ? `Site ${site.name} added under ${client.name} by ${user.name}`
      : `Site ${site.name} under ${client.name} registered by ${user.name} — pending approval`,
  });

  if (!selfApproves) {
    await notifyApprovers({
      title: `Site approval · ${site.name}`,
      body: `${user.name} added site ${site.name} to ${client.name} — approve or reject it.`,
      exceptUserId: user.sub,
    });
  }

  return Response.json({ site });
}
