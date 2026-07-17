import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { rolesOf, canPrepareQuotes, isClient } from "@/lib/roles";
import { amountInWords, quoteTotals } from "@/lib/money";
import { sendMail, quoteIssuedEmail, quoteDecisionEmail } from "@/lib/email";
import { notifyEmails } from "@/lib/notify";

function ownedByClient(user, q) {
  return isClient(user) && (q.requestedById === user.sub || (user.clientId && q.clientId === user.clientId));
}
function canView(user, q) {
  const roles = rolesOf(user);
  return roles.includes("ADMIN") || canPrepareQuotes(user) || ownedByClient(user, q);
}

export async function GET(_req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const q = await prisma.quotation.findUnique({ where: { id: params.id } });
  if (!q) return Response.json({ error: "Not found." }, { status: 404 });
  if (!canView(user, q)) return Response.json({ error: "Not allowed." }, { status: 403 });
  return Response.json({
    quotation: q,
    permissions: {
      canPrepare: canPrepareQuotes(user) || rolesOf(user).includes("ADMIN"),
      canDecide: ownedByClient(user, q) && q.status === "QUOTED",
    },
  });
}

// PATCH — PM/TM fill/issue the quote; the client accepts/declines.
export async function PATCH(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const q = await prisma.quotation.findUnique({ where: { id: params.id } });
  if (!q) return Response.json({ error: "Not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const staff = canPrepareQuotes(user) || rolesOf(user).includes("ADMIN");

  // --- Client accept / decline ---
  if (body.clientDecision) {
    if (!ownedByClient(user, q)) return Response.json({ error: "Not allowed." }, { status: 403 });
    if (q.status !== "QUOTED") return Response.json({ error: "This quotation can't be actioned now." }, { status: 400 });
    const decision = body.clientDecision === "ACCEPTED" ? "ACCEPTED" : body.clientDecision === "DECLINED" ? "DECLINED" : null;
    if (!decision) return Response.json({ error: "Invalid decision." }, { status: 400 });
    const updated = await prisma.quotation.update({
      where: { id: q.id },
      data: { status: decision, decidedAt: new Date() },
    });
    await recordAudit({ actor: user, action: "UPDATE", entity: "QUOTATION", entityId: q.number, summary: `Quotation ${q.number} ${decision.toLowerCase()} by client` });
    try {
      const preparers = await prisma.user.findMany({ where: { active: true, roles: { hasSome: ["PROJECT_MANAGER", "TECHNICAL_MANAGER"] } }, select: { id: true, email: true } });
      const emails = preparers.map((u) => u.email).filter(Boolean);
      if (emails.length) await sendMail(quoteDecisionEmail(emails.join(", "), updated, decision));
      await notifyEmails(emails, { type: "SYSTEM", title: `Quote ${decision.toLowerCase()} · ${q.number}`, body: `${q.clientName} ${decision.toLowerCase()} the quotation`, link: `/quotations/${q.id}` });
    } catch {
      /* best-effort */
    }
    return Response.json({ ok: true, status: updated.status });
  }

  // --- Staff prepare / issue ---
  if (!staff) return Response.json({ error: "Only PM / TM can prepare a quotation." }, { status: 403 });

  const items = (Array.isArray(body.items) ? body.items : [])
    .map((it) => ({
      description: String(it?.description || "").trim(),
      qty: Number(it?.qty) || 0,
      unit: String(it?.unit || "").trim() || "EA",
      unitPrice: Number(it?.unitPrice) || 0,
    }))
    .filter((it) => it.description);

  const currency = String(body.currency || q.currency || "KES").trim() || "KES";
  const vatRate = body.vatRate != null ? Number(body.vatRate) : q.vatRate;
  const freight = body.freight != null ? Number(body.freight) : q.freight;
  const totals = quoteTotals(items, vatRate, freight);
  const issue = body.issue === true;

  if (issue && items.length === 0)
    return Response.json({ error: "Add at least one line item before issuing." }, { status: 400 });

  const data = {
    items,
    currency,
    vatRate,
    freight,
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    grandTotal: totals.grandTotal,
    amountInWords: amountInWords(totals.grandTotal, currency),
    notes: String(body.notes || "").trim() || null,
    validUntil: body.validUntil ? new Date(body.validUntil) : q.validUntil,
  };
  if (issue) {
    data.status = "QUOTED";
    data.preparedByName = user.name;
    data.quotedAt = new Date();
  }

  const updated = await prisma.quotation.update({ where: { id: q.id }, data });

  await recordAudit({
    actor: user,
    action: "UPDATE",
    entity: "QUOTATION",
    entityId: q.number,
    summary: issue ? `Quotation ${q.number} issued (${currency} ${totals.grandTotal.toLocaleString()})` : `Quotation ${q.number} draft saved`,
  });

  // On issue, email the client the quote.
  if (issue && updated.contactEmail) {
    try {
      await sendMail(quoteIssuedEmail(updated.contactEmail, updated));
    } catch {
      /* best-effort */
    }
  }

  return Response.json({ ok: true, status: updated.status });
}
