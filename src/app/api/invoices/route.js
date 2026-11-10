import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { nextSerial } from "@/lib/serial";
import { recordAudit } from "@/lib/audit";
import { rolesOf, MANAGER_ROLES } from "@/lib/roles";
import { resolveClientByName } from "@/lib/clientResolve";
import { getSettings } from "@/lib/settings";
import { DEFAULT_PAYMENT_DETAILS } from "@/lib/company";
import { computeInvoiceTotals } from "@/lib/invoice";

export const dynamic = "force-dynamic";

// Only managers / admins raise invoices.
const FINANCE_ROLES = [...MANAGER_ROLES, "ADMIN"];
const canInvoice = (user) => rolesOf(user).some((r) => FINANCE_ROLES.includes(r));

// GET /api/invoices?status=&q=
export async function GET(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canInvoice(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = (searchParams.get("q") || "").trim();
  const where = { AND: [] };
  if (status && status !== "all") where.AND.push({ status });
  if (q) {
    where.AND.push({
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { clientName: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
        { ref: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true, number: true, clientName: true, subject: true, status: true,
      currency: true, grandTotal: true, dueDate: true, issuedByName: true,
      createdAt: true, issuedAt: true, paidAt: true,
    },
  });
  return Response.json({ invoices });
}

// POST /api/invoices — raise an invoice (standalone or from a quotation).
export async function POST(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canInvoice(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  // Optionally seed from an accepted quotation.
  let fromQuote = null;
  if (body.quotationId) {
    fromQuote = await prisma.quotation.findUnique({ where: { id: String(body.quotationId) } });
    if (!fromQuote) return Response.json({ error: "That quotation was not found." }, { status: 400 });
  }

  // Resolve the client (by id, or by name, or inherit from the quotation).
  let clientId = null;
  let clientName = String(body.clientName || fromQuote?.clientName || "").trim();
  if (body.clientId) {
    const c = await prisma.client.findUnique({ where: { id: String(body.clientId) } });
    if (!c) return Response.json({ error: "That client isn't registered." }, { status: 400 });
    clientId = c.id;
    clientName = c.name;
  } else if (fromQuote?.clientId) {
    clientId = fromQuote.clientId;
  } else if (clientName) {
    const c = await resolveClientByName(clientName);
    clientId = c.id;
    clientName = c.name;
  }
  if (!clientName) return Response.json({ error: "Client is required." }, { status: 400 });

  const settings = await getSettings();
  const currency = String(body.currency || fromQuote?.currency || settings.finance.currency || "KES");
  const vatRate = body.vatRate != null ? Number(body.vatRate) : (fromQuote?.vatRate ?? settings.finance.vatRate ?? 16);
  const retentionRate = Number(body.retentionRate || 0);

  const items = (Array.isArray(body.items) ? body.items : fromQuote?.items || [])
    .map((it) => ({
      description: String(it.description || "").trim(),
      qty: Number(it.qty) || 0,
      unit: String(it.unit || "EA").trim() || "EA",
      unitPrice: Number(it.unitPrice) || 0,
    }))
    .filter((it) => it.description);
  if (items.length === 0) return Response.json({ error: "Add at least one line item." }, { status: 400 });

  const totals = computeInvoiceTotals(items, vatRate, retentionRate);
  const number = await nextSerial("INV");
  const status = body.status === "DRAFT" ? "DRAFT" : "UNPAID";
  const dueDate = body.dueDate ? new Date(body.dueDate) : null;

  const created = await prisma.invoice.create({
    data: {
      number,
      clientId,
      clientName,
      siteName: String(body.siteName || fromQuote?.siteName || "").trim() || null,
      contactPerson: String(body.contactPerson || fromQuote?.contactPerson || "").trim() || null,
      contactEmail: String(body.contactEmail || fromQuote?.contactEmail || "").trim() || null,
      contactPhone: String(body.contactPhone || fromQuote?.contactPhone || "").trim() || null,
      status,
      subject: String(body.subject || fromQuote?.subject || "").trim() || null,
      ref: String(body.ref || fromQuote?.number || "").trim() || null,
      fileNo: String(body.fileNo || "").trim() || null,
      quotationId: fromQuote?.id || null,
      items,
      currency,
      vatRate,
      retentionRate,
      ...totals,
      amountInWords: String(body.amountInWords || "").trim() || null,
      notes: String(body.notes || "").trim() || null,
      paymentDetails: String(body.paymentDetails || "").trim() || DEFAULT_PAYMENT_DETAILS,
      terms: String(body.terms || "").trim() || null,
      dueDate: dueDate && !isNaN(dueDate) ? dueDate : null,
      issuedByName: user.name,
      issuedById: user.sub,
      issuedAt: status === "UNPAID" ? new Date() : null,
    },
  });

  await recordAudit({
    actor: user,
    action: "CREATE",
    entity: "INVOICE",
    entityId: created.number,
    summary: `Invoice ${created.number} raised by ${user.name} for ${clientName} — ${currency} ${totals.grandTotal.toLocaleString()}`,
  });

  return Response.json({ id: created.id, number: created.number });
}
