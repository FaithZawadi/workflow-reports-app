import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { nextSerial } from "@/lib/serial";
import { recordAudit } from "@/lib/audit";
import { rolesOf, LPO_CREATE_ROLES } from "@/lib/roles";
import { getSettings } from "@/lib/settings";
import { computeInvoiceTotals } from "@/lib/invoice";

export const dynamic = "force-dynamic";

const canCreateLpo = (user) => rolesOf(user).some((r) => LPO_CREATE_ROLES.includes(r));

// POST /api/purchase-requests/[id]/convert — raise a DRAFT LPO from an approved
// purchase request, pre-filled with its items and suggested supplier. The
// manager then completes the supplier details and submits it for approval.
export async function POST(_req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canCreateLpo(user)) return Response.json({ error: "Only managers, the CFO or the MD can raise an LPO." }, { status: 403 });

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: params.id } });
  if (!pr) return Response.json({ error: "Request not found." }, { status: 404 });
  if (pr.status !== "APPROVED") return Response.json({ error: "Only an approved request can be raised as an LPO." }, { status: 400 });

  const settings = await getSettings();
  const vatRate = settings.finance?.vatRate ?? 16;
  const items = (Array.isArray(pr.items) ? pr.items : []).map((it) => ({
    description: String(it.description || "").trim(),
    qty: Number(it.qty) || 0,
    unit: String(it.unit || "EA").trim() || "EA",
    unitPrice: Number(it.estUnitPrice) || 0, // estimate carried as the starting price
  }));
  const { subtotal, vatAmount, grandTotal } = computeInvoiceTotals(items, vatRate, 0);
  const number = await nextSerial("LPO");

  const lpo = await prisma.lpo.create({
    data: {
      number,
      status: "DRAFT",
      currency: pr.currency || "KES",
      supplierName: pr.suggestedSupplier || "Supplier — to be set",
      subject: pr.title || null,
      requiredBy: pr.requiredBy || null,
      items,
      vatRate,
      subtotal,
      vatAmount,
      grandTotal,
      buyerName: user.name,
      raisedByName: user.name,
      raisedById: user.sub || null,
      fromRequestId: pr.id,
      fromRequestNumber: pr.number,
    },
  });

  await prisma.purchaseRequest.update({
    where: { id: pr.id },
    data: { status: "CONVERTED", lpoId: lpo.id, lpoNumber: lpo.number },
  });

  await recordAudit({
    actor: user,
    action: "CREATE",
    entity: "LPO",
    entityId: lpo.number,
    summary: `LPO ${lpo.number} raised from purchase request ${pr.number} by ${user.name}`,
  });

  return Response.json({ lpoId: lpo.id, lpoNumber: lpo.number });
}
