import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { rolesOf, LPO_ROLES } from "@/lib/roles";
import { computeInvoiceTotals } from "@/lib/invoice";

export const dynamic = "force-dynamic";

const canLpo = (user) => rolesOf(user).some((r) => LPO_ROLES.includes(r));

export async function GET(_req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canLpo(user)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const lpo = await prisma.lpo.findUnique({ where: { id: params.id } });
  if (!lpo) return Response.json({ error: "LPO not found." }, { status: 404 });
  return Response.json({ lpo });
}

// PATCH — change status (issue / approve / cancel) or edit the order.
export async function PATCH(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canLpo(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const lpo = await prisma.lpo.findUnique({ where: { id: params.id } });
  if (!lpo) return Response.json({ error: "LPO not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data = {};

  if (body.status && ["DRAFT", "PENDING", "APPROVED", "CANCELLED"].includes(body.status)) {
    data.status = body.status;
    if (body.status === "PENDING" && !lpo.issuedAt) data.issuedAt = new Date();
    if (body.status === "APPROVED") {
      data.approvedByName = String(body.approvedByName || user.name || "").trim() || null;
      data.approvedById = user.sub || null;
      data.approvedAt = new Date();
      if (!lpo.issuedAt) data.issuedAt = new Date();
    }
  }

  // Optional edits.
  const text = ["supplierName", "supplierContact", "supplierTel", "supplierEmail", "supplierPin", "deliverTo", "paymentTerms", "supplierQuoteRef", "buyerName", "subject", "notes", "amountInWords", "notedByName", "conditionsRev"];
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

  const updated = await prisma.lpo.update({ where: { id: lpo.id }, data });

  await recordAudit({
    actor: user,
    action: "UPDATE",
    entity: "LPO",
    entityId: lpo.number,
    summary: `LPO ${lpo.number} ${data.status ? `marked ${data.status}` : "edited"} by ${user.name}`,
  });

  return Response.json({ ok: true, status: updated.status });
}
