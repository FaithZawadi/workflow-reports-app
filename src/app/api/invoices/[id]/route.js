import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { rolesOf, MANAGER_ROLES } from "@/lib/roles";
import { computeInvoiceTotals } from "@/lib/invoice";

export const dynamic = "force-dynamic";

const FINANCE_ROLES = [...MANAGER_ROLES, "ADMIN"];
const canInvoice = (user) => rolesOf(user).some((r) => FINANCE_ROLES.includes(r));

export async function GET(_req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canInvoice(user)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) return Response.json({ error: "Invoice not found." }, { status: 404 });
  return Response.json({ invoice });
}

// PATCH — change status (mark paid / cancel / reissue) or edit the invoice.
export async function PATCH(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canInvoice(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) return Response.json({ error: "Invoice not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data = {};

  if (body.status && ["DRAFT", "UNPAID", "PAID", "CANCELLED"].includes(body.status)) {
    data.status = body.status;
    if (body.status === "PAID") data.paidAt = new Date();
    if (body.status === "UNPAID" && !invoice.issuedAt) data.issuedAt = new Date();
    if (body.status === "UNPAID") data.paidAt = null;
  }

  // Optional edits — recompute money whenever items/rates change.
  const editable = ["subject", "ref", "fileNo", "notes", "terms", "paymentDetails", "amountInWords", "contactPerson", "contactEmail", "contactPhone", "siteName"];
  for (const k of editable) if (body[k] !== undefined) data[k] = String(body[k] || "").trim() || null;
  if (body.dueDate !== undefined) {
    const d = body.dueDate ? new Date(body.dueDate) : null;
    data.dueDate = d && !isNaN(d) ? d : null;
  }

  const willRecompute = body.items !== undefined || body.vatRate !== undefined || body.retentionRate !== undefined;
  if (willRecompute) {
    const items = (Array.isArray(body.items) ? body.items : invoice.items || [])
      .map((it) => ({ description: String(it.description || "").trim(), qty: Number(it.qty) || 0, unit: String(it.unit || "EA").trim() || "EA", unitPrice: Number(it.unitPrice) || 0 }))
      .filter((it) => it.description);
    const vatRate = body.vatRate != null ? Number(body.vatRate) : invoice.vatRate;
    const retentionRate = body.retentionRate != null ? Number(body.retentionRate) : invoice.retentionRate;
    data.items = items;
    data.vatRate = vatRate;
    data.retentionRate = retentionRate;
    Object.assign(data, computeInvoiceTotals(items, vatRate, retentionRate));
  }

  const updated = await prisma.invoice.update({ where: { id: invoice.id }, data });

  await recordAudit({
    actor: user,
    action: "UPDATE",
    entity: "INVOICE",
    entityId: invoice.number,
    summary: `Invoice ${invoice.number} ${data.status ? `marked ${data.status}` : "edited"} by ${user.name}`,
  });

  return Response.json({ ok: true, status: updated.status });
}
