import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { rolesOf, LPO_ROLES, LPO_CREATE_ROLES, canApproveLpoStage } from "@/lib/roles";
import { computeInvoiceTotals } from "@/lib/invoice";

export const dynamic = "force-dynamic";

const canSee = (user) => rolesOf(user).some((r) => LPO_ROLES.includes(r));
const canCreate = (user) => rolesOf(user).some((r) => LPO_CREATE_ROLES.includes(r));

// The next pending stage after the current one, and the fields to stamp when the
// current stage is approved.
const STAGE_FLOW = {
  PENDING_TM: { next: "PENDING_CFO", by: "tmApprovedByName", id: "tmApprovedById", at: "tmApprovedAt", label: "Technical Manager" },
  PENDING_CFO: { next: "PENDING_MD", by: "cfoApprovedByName", id: "cfoApprovedById", at: "cfoApprovedAt", label: "Chief Finance Officer" },
  PENDING_MD: { next: "APPROVED", by: "mdApprovedByName", id: "mdApprovedById", at: "mdApprovedAt", label: "Managing Director" },
};

export async function GET(_req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canSee(user)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const lpo = await prisma.lpo.findUnique({ where: { id: params.id } });
  if (!lpo) return Response.json({ error: "LPO not found." }, { status: 404 });
  return Response.json({ lpo });
}

// PATCH — submit for approval, approve the current stage, reject, cancel, or
// edit a draft. Approvals move up the chain Technical Manager -> CFO -> MD.
export async function PATCH(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canSee(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const lpo = await prisma.lpo.findUnique({ where: { id: params.id } });
  if (!lpo) return Response.json({ error: "LPO not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const now = new Date();

  // ---- Workflow actions -------------------------------------------------
  if (action === "submit") {
    if (!canCreate(user)) return Response.json({ error: "Only managers, the CFO or the MD can raise an LPO for approval." }, { status: 403 });
    if (!["DRAFT", "PENDING"].includes(lpo.status)) return Response.json({ error: "This order has already been submitted." }, { status: 400 });
    const updated = await prisma.lpo.update({
      where: { id: lpo.id },
      data: { status: "PENDING_TM", issuedAt: lpo.issuedAt || now },
    });
    await recordAudit({ actor: user, action: "UPDATE", entity: "LPO", entityId: lpo.number, summary: `LPO ${lpo.number} submitted for approval by ${user.name}` });
    return Response.json({ ok: true, status: updated.status });
  }

  if (action === "approve") {
    const flow = STAGE_FLOW[lpo.status];
    if (!flow) return Response.json({ error: "This order isn't awaiting approval." }, { status: 400 });
    if (!canApproveLpoStage(lpo.status, user)) return Response.json({ error: `Only the ${flow.label} can approve this stage.` }, { status: 403 });
    const data = {
      [flow.by]: user.name,
      [flow.id]: user.sub || null,
      [flow.at]: now,
      status: flow.next,
    };
    if (flow.next === "APPROVED") {
      data.approvedByName = user.name;
      data.approvedById = user.sub || null;
      data.approvedAt = now;
    }
    const updated = await prisma.lpo.update({ where: { id: lpo.id }, data });
    await recordAudit({ actor: user, action: "APPROVE", entity: "LPO", entityId: lpo.number, summary: `LPO ${lpo.number} approved by ${user.name} (${flow.label})${flow.next === "APPROVED" ? " — fully authorised" : ""}` });
    return Response.json({ ok: true, status: updated.status });
  }

  if (action === "reject") {
    const flow = STAGE_FLOW[lpo.status];
    if (!flow) return Response.json({ error: "This order isn't awaiting approval." }, { status: 400 });
    if (!canApproveLpoStage(lpo.status, user)) return Response.json({ error: `Only the ${flow.label} can act on this stage.` }, { status: 403 });
    const comment = String(body.comment || "").trim();
    if (!comment) return Response.json({ error: "A reason is required to reject." }, { status: 400 });
    const updated = await prisma.lpo.update({
      where: { id: lpo.id },
      data: { status: "CANCELLED", rejectedByName: user.name, rejectedAt: now, rejectComment: comment },
    });
    await recordAudit({ actor: user, action: "REJECT", entity: "LPO", entityId: lpo.number, summary: `LPO ${lpo.number} rejected by ${user.name} (${flow.label}) — "${comment}"` });
    return Response.json({ ok: true, status: updated.status });
  }

  if (action === "cancel") {
    const updated = await prisma.lpo.update({ where: { id: lpo.id }, data: { status: "CANCELLED" } });
    await recordAudit({ actor: user, action: "UPDATE", entity: "LPO", entityId: lpo.number, summary: `LPO ${lpo.number} cancelled by ${user.name}` });
    return Response.json({ ok: true, status: updated.status });
  }

  // ---- Edits (draft content) -------------------------------------------
  if (!canCreate(user)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const data = {};
  const text = ["supplierName", "supplierContact", "supplierTel", "supplierEmail", "supplierPin", "deliverTo", "paymentTerms", "supplierQuoteRef", "buyerName", "subject", "notes", "amountInWords", "conditionsRev"];
  for (const k of text) if (body[k] !== undefined) data[k] = String(body[k] || "").trim() || null;
  for (const k of ["deliveryDate", "requiredBy"]) {
    if (body[k] !== undefined) {
      const d = body[k] ? new Date(body[k]) : null;
      data[k] = d && !isNaN(d) ? d : null;
    }
  }
  const willRecompute = body.items !== undefined || body.vatRate !== undefined;
  if (willRecompute) {
    const items = (Array.isArray(body.items) ? body.items : lpo.items || [])
      .map((it) => ({ description: String(it.description || "").trim(), qty: Number(it.qty) || 0, unit: String(it.unit || "EA").trim() || "EA", unitPrice: Number(it.unitPrice) || 0 }))
      .filter((it) => it.description);
    const vatRate = body.vatRate != null ? Number(body.vatRate) : lpo.vatRate;
    const { subtotal, vatAmount, grandTotal } = computeInvoiceTotals(items, vatRate, 0);
    data.items = items;
    data.vatRate = vatRate;
    data.subtotal = subtotal;
    data.vatAmount = vatAmount;
    data.grandTotal = grandTotal;
  }
  if (Object.keys(data).length === 0) return Response.json({ error: "Nothing to update." }, { status: 400 });

  const updated = await prisma.lpo.update({ where: { id: lpo.id }, data });
  await recordAudit({ actor: user, action: "UPDATE", entity: "LPO", entityId: lpo.number, summary: `LPO ${lpo.number} edited by ${user.name}` });
  return Response.json({ ok: true, status: updated.status });
}
