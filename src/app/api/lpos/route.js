import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { nextSerial } from "@/lib/serial";
import { recordAudit } from "@/lib/audit";
import { rolesOf, LPO_ROLES, LPO_CREATE_ROLES } from "@/lib/roles";
import { getSettings } from "@/lib/settings";
import { computeInvoiceTotals } from "@/lib/invoice";

export const dynamic = "force-dynamic";

const canLpo = (user) => rolesOf(user).some((r) => LPO_ROLES.includes(r));
const canCreate = (user) => rolesOf(user).some((r) => LPO_CREATE_ROLES.includes(r));

// Normalise and total a set of line items (LPO has no retention).
function cleanItems(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((it) => ({
      description: String(it.description || "").trim(),
      qty: Number(it.qty) || 0,
      unit: String(it.unit || "EA").trim() || "EA",
      unitPrice: Number(it.unitPrice) || 0,
    }))
    .filter((it) => it.description);
}

// GET /api/lpos?status=&q=
export async function GET(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canLpo(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = (searchParams.get("q") || "").trim();
  const where = { AND: [] };
  if (status && status !== "all") where.AND.push({ status });
  if (q) {
    where.AND.push({
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { supplierName: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
        { supplierQuoteRef: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const lpos = await prisma.lpo.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true, number: true, supplierName: true, subject: true, status: true,
      currency: true, grandTotal: true, requiredBy: true, buyerName: true,
      createdAt: true, issuedAt: true, approvedAt: true,
    },
  });
  return Response.json({ lpos });
}

// POST /api/lpos — raise a purchase order.
export async function POST(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canCreate(user)) return Response.json({ error: "Only managers, the CFO or the MD can raise an LPO. Technicians raise a purchase request instead." }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const supplierName = String(body.supplierName || "").trim();
  if (!supplierName) return Response.json({ error: "Supplier is required." }, { status: 400 });

  const items = cleanItems(body.items);
  if (items.length === 0) return Response.json({ error: "Add at least one line item." }, { status: 400 });

  const settings = await getSettings();
  const currency = String(body.currency || settings.finance.currency || "KES");
  const vatRate = body.vatRate != null ? Number(body.vatRate) : (settings.finance.vatRate ?? 16);
  const { subtotal, vatAmount, grandTotal } = computeInvoiceTotals(items, vatRate, 0);

  const number = await nextSerial("LPO");
  // Submitting an LPO starts the approval chain at the Technical Manager.
  const status = body.status === "DRAFT" ? "DRAFT" : "PENDING_TM";
  const toDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d) ? null : d;
  };

  const created = await prisma.lpo.create({
    data: {
      number,
      status,
      currency,
      supplierName,
      supplierContact: String(body.supplierContact || "").trim() || null,
      supplierTel: String(body.supplierTel || "").trim() || null,
      supplierEmail: String(body.supplierEmail || "").trim() || null,
      supplierPin: String(body.supplierPin || "").trim() || null,
      deliverTo: String(body.deliverTo || "").trim() || null,
      deliveryDate: toDate(body.deliveryDate),
      requiredBy: toDate(body.requiredBy),
      paymentTerms: String(body.paymentTerms || "").trim() || null,
      supplierQuoteRef: String(body.supplierQuoteRef || "").trim() || null,
      buyerName: String(body.buyerName || user.name || "").trim() || null,
      subject: String(body.subject || "").trim() || null,
      items,
      vatRate,
      subtotal,
      vatAmount,
      grandTotal,
      amountInWords: String(body.amountInWords || "").trim() || null,
      notes: String(body.notes || "").trim() || null,
      raisedByName: user.name,
      raisedById: user.sub,
      issuedAt: status === "PENDING_TM" ? new Date() : null,
    },
  });

  await recordAudit({
    actor: user,
    action: "CREATE",
    entity: "LPO",
    entityId: created.number,
    summary: `LPO ${created.number} raised by ${user.name} for ${supplierName} — ${currency} ${grandTotal.toLocaleString()}`,
  });

  return Response.json({ id: created.id, number: created.number });
}
