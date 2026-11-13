import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { rolesOf, PR_CREATE_ROLES, PR_REVIEW_ROLES } from "@/lib/roles";

export const dynamic = "force-dynamic";

const canCreate = (user) => rolesOf(user).some((r) => PR_CREATE_ROLES.includes(r));
const canReview = (user) => rolesOf(user).some((r) => PR_REVIEW_ROLES.includes(r));

export async function GET(_req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canCreate(user)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const pr = await prisma.purchaseRequest.findUnique({ where: { id: params.id } });
  if (!pr) return Response.json({ error: "Request not found." }, { status: 404 });
  // Non-reviewers may only read their own.
  if (!canReview(user) && pr.requestedById !== user.sub) return Response.json({ error: "Not allowed." }, { status: 403 });
  return Response.json({ request: pr });
}

// PATCH — a manager approves/declines a pending request; the requester may
// cancel or edit their own while it is still pending.
export async function PATCH(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canCreate(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: params.id } });
  if (!pr) return Response.json({ error: "Request not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const now = new Date();
  const mine = pr.requestedById && pr.requestedById === user.sub;

  if (action === "approve" || action === "decline") {
    if (!canReview(user)) return Response.json({ error: "Only a manager can review purchase requests." }, { status: 403 });
    if (pr.status !== "PENDING") return Response.json({ error: "This request has already been reviewed." }, { status: 400 });
    const comment = String(body.comment || "").trim();
    if (action === "decline" && !comment) return Response.json({ error: "A reason is required to decline." }, { status: 400 });
    const updated = await prisma.purchaseRequest.update({
      where: { id: pr.id },
      data: { status: action === "approve" ? "APPROVED" : "DECLINED", reviewedByName: user.name, reviewedById: user.sub || null, reviewedAt: now, reviewComment: comment || null },
    });
    await recordAudit({ actor: user, action: action === "approve" ? "APPROVE" : "REJECT", entity: "PURCHASE_REQUEST", entityId: pr.number, summary: `Purchase request ${pr.number} ${action === "approve" ? "approved" : "declined"} by ${user.name}${comment ? ` — "${comment}"` : ""}` });
    return Response.json({ ok: true, status: updated.status });
  }

  if (action === "cancel") {
    if (!mine && !canReview(user)) return Response.json({ error: "Only the requester can cancel this." }, { status: 403 });
    if (!["PENDING", "APPROVED"].includes(pr.status)) return Response.json({ error: "This request can no longer be cancelled." }, { status: 400 });
    const updated = await prisma.purchaseRequest.update({ where: { id: pr.id }, data: { status: "CANCELLED" } });
    await recordAudit({ actor: user, action: "UPDATE", entity: "PURCHASE_REQUEST", entityId: pr.number, summary: `Purchase request ${pr.number} cancelled by ${user.name}` });
    return Response.json({ ok: true, status: updated.status });
  }

  // Edit (requester, while pending).
  if (!mine) return Response.json({ error: "Only the requester can edit this." }, { status: 403 });
  if (pr.status !== "PENDING") return Response.json({ error: "A reviewed request can't be edited." }, { status: 400 });
  const data = {};
  for (const k of ["title", "justification", "suggestedSupplier"]) if (body[k] !== undefined) data[k] = String(body[k] || "").trim() || null;
  if (body.requiredBy !== undefined) {
    const d = body.requiredBy ? new Date(body.requiredBy) : null;
    data.requiredBy = d && !isNaN(d) ? d : null;
  }
  if (body.items !== undefined) {
    const items = (Array.isArray(body.items) ? body.items : [])
      .map((it) => ({ description: String(it.description || "").trim(), qty: Number(it.qty) || 0, unit: String(it.unit || "EA").trim() || "EA", estUnitPrice: Number(it.estUnitPrice) || 0 }))
      .filter((it) => it.description);
    data.items = items;
    data.estTotal = Math.round(items.reduce((s, it) => s + it.qty * it.estUnitPrice, 0) * 100) / 100;
  }
  if (Object.keys(data).length === 0) return Response.json({ error: "Nothing to update." }, { status: 400 });
  const updated = await prisma.purchaseRequest.update({ where: { id: pr.id }, data });
  await recordAudit({ actor: user, action: "UPDATE", entity: "PURCHASE_REQUEST", entityId: pr.number, summary: `Purchase request ${pr.number} edited by ${user.name}` });
  return Response.json({ ok: true, status: updated.status });
}
