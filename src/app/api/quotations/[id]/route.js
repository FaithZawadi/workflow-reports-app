import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { rolesOf, canPrepareQuotes, isClient, canRaiseOwnQuotes } from "@/lib/roles";
import { amountInWords, quoteTotals } from "@/lib/money";
import { sendMail, quoteIssuedEmail, quoteDecisionEmail } from "@/lib/email";
import { notifyEmails, notifyUsers } from "@/lib/notify";
import { getSettings } from "@/lib/settings";

function ownedByClient(user, q) {
  return isClient(user) && (q.requestedById === user.sub || (user.clientId && q.clientId === user.clientId));
}
// A Technician / Sales user owns the quotations they created — they may view and
// prepare only those, never anyone else's.
function ownedByAuthor(user, q) {
  return canRaiseOwnQuotes(user) && q.requestedById === user.sub;
}
// Whoever may fully prepare/issue this quote: PM/TM/admin (any), or the
// Technician / Sales user who created it.
function canPrepareThis(user, q) {
  return canPrepareQuotes(user) || rolesOf(user).includes("ADMIN") || ownedByAuthor(user, q);
}
function canView(user, q) {
  const roles = rolesOf(user);
  return roles.includes("ADMIN") || canPrepareQuotes(user) || ownedByClient(user, q) || ownedByAuthor(user, q);
}

// DELETE — remove a quotation (e.g. clearing out test/dummy quotes). Admins and
// the quote preparers (PM / TM) may delete.
export async function DELETE(_req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!(rolesOf(user).includes("ADMIN") || canPrepareQuotes(user)))
    return Response.json({ error: "Only admins or PM/TM can delete quotations." }, { status: 403 });

  const q = await prisma.quotation.findUnique({ where: { id: params.id } });
  if (!q) return Response.json({ error: "Not found." }, { status: 404 });

  await prisma.quotation.delete({ where: { id: q.id } });
  await recordAudit({ actor: user, action: "DELETE", entity: "QUOTATION", entityId: q.number, summary: `Deleted quotation ${q.number} (${q.clientName})` });
  return Response.json({ ok: true });
}

export async function GET(_req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  let q = await prisma.quotation.findUnique({ where: { id: params.id } });
  if (!q) return Response.json({ error: "Not found." }, { status: 404 });
  if (!canView(user, q)) return Response.json({ error: "Not allowed." }, { status: 403 });

  // Mint the opaque share slug the first time the quote is opened. It backs the
  // public /d/<token> link so staff can share the PDF without exposing the id or
  // the API path.
  if (!q.shareToken) {
    try {
      q = await prisma.quotation.update({
        where: { id: q.id },
        data: { shareToken: crypto.randomBytes(18).toString("base64url") },
      });
    } catch {
      /* best-effort — a unique clash is astronomically unlikely; keep serving */
    }
  }

  return Response.json({
    quotation: q,
    permissions: {
      canPrepare: canPrepareThis(user, q),
      canDecide: ownedByClient(user, q) && q.status === "QUOTED",
      // The owning client may attach/replace their LPO once the quote is issued.
      canUploadLpo: ownedByClient(user, q) && q.status !== "REQUESTED",
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
  const staff = canPrepareThis(user, q);

  // --- LPO image upload / removal (client owner or staff) ---
  if (body.lpoImage !== undefined) {
    if (!(ownedByClient(user, q) || staff)) return Response.json({ error: "Not allowed." }, { status: 403 });
    const img = body.lpoImage;
    if (!img) {
      const updated = await prisma.quotation.update({ where: { id: q.id }, data: { lpoImage: null, lpoName: null, lpoUploadedAt: null } });
      await recordAudit({ actor: user, action: "UPDATE", entity: "QUOTATION", entityId: q.number, summary: `LPO removed from quotation ${q.number}` });
      return Response.json({ ok: true, lpo: false });
    }
    if (typeof img !== "string" || !/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(img))
      return Response.json({ error: "The LPO must be an image file." }, { status: 400 });
    // Enforce a 2 MB cap on the decoded image.
    const b64 = img.slice(img.indexOf(",") + 1);
    const bytes = Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
    if (bytes > 2 * 1024 * 1024) return Response.json({ error: "The LPO image must be 2 MB or smaller." }, { status: 413 });
    const updated = await prisma.quotation.update({
      where: { id: q.id },
      data: { lpoImage: img, lpoName: String(body.lpoName || "").trim().slice(0, 200) || "LPO", lpoUploadedAt: new Date() },
    });
    await recordAudit({ actor: user, action: "UPDATE", entity: "QUOTATION", entityId: q.number, summary: `LPO uploaded to quotation ${q.number}` });
    // Let the QSL preparers know an LPO arrived.
    if (ownedByClient(user, q)) {
      try {
        const preparers = await prisma.user.findMany({ where: { active: true, roles: { hasSome: ["PROJECT_MANAGER", "TECHNICAL_MANAGER"] } }, select: { id: true } });
        await notifyUsers(preparers.map((u) => u.id), { type: "SYSTEM", title: `LPO received · ${q.number}`, body: `${q.clientName} uploaded an LPO`, link: `/quotations/${q.id}` });
      } catch {
        /* best-effort */
      }
    }
    return Response.json({ ok: true, lpo: true });
  }

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

  // --- Staff record the outcome (client often accepts/declines offline) ---
  if (body.staffDecision) {
    if (!staff) return Response.json({ error: "Only PM / TM can record the outcome." }, { status: 403 });
    if (q.status !== "QUOTED") return Response.json({ error: "This quotation can't be actioned now." }, { status: 400 });
    const decision = body.staffDecision === "ACCEPTED" ? "ACCEPTED" : body.staffDecision === "DECLINED" ? "DECLINED" : null;
    if (!decision) return Response.json({ error: "Invalid decision." }, { status: 400 });
    const updated = await prisma.quotation.update({ where: { id: q.id }, data: { status: decision, decidedAt: new Date() } });
    await recordAudit({ actor: user, action: "UPDATE", entity: "QUOTATION", entityId: q.number, summary: `Quotation ${q.number} recorded ${decision.toLowerCase()} by ${user.name}` });
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

  const settings = await getSettings();
  const currency = String(body.currency || q.currency || settings.finance.currency || "KES").trim() || "KES";
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
    // Default the validity window from settings when issuing without an explicit
    // date (issue date + configured validity days).
    validUntil: body.validUntil
      ? new Date(body.validUntil)
      : q.validUntil || (issue ? new Date(Date.now() + (settings.finance.quoteValidityDays || 30) * 86400000) : null),
  };
  // Client contact details may be captured/updated when issuing.
  if (body.contactEmail !== undefined) data.contactEmail = String(body.contactEmail || "").trim() || null;
  if (body.contactPhone !== undefined) data.contactPhone = String(body.contactPhone || "").trim() || null;
  if (body.contactPerson !== undefined) data.contactPerson = String(body.contactPerson || "").trim() || null;
  // Invoice-style fields: subject line, file/ref no, and the editable payment
  // details + terms-of-sale blocks printed on the quotation PDF.
  if (body.subject !== undefined) data.subject = String(body.subject || "").trim() || null;
  if (body.fileNo !== undefined) data.fileNo = String(body.fileNo || "").trim() || null;
  if (body.paymentDetails !== undefined) data.paymentDetails = String(body.paymentDetails || "").trim() || null;
  if (body.terms !== undefined) data.terms = String(body.terms || "").trim() || null;
  // When issuing without payment/terms text, fall back to the configured
  // defaults so every issued quote carries them.
  if (issue) {
    if (!data.paymentDetails && !q.paymentDetails && settings.finance.paymentDetails) data.paymentDetails = settings.finance.paymentDetails;
    if (!data.terms && !q.terms && settings.finance.quoteTerms) data.terms = settings.finance.quoteTerms;
  }
  // Re-issuing a quote that was already issued once is an amendment — log who
  // amended it, when, why, and the value change, and bump the revision number.
  const isAmendment = issue && !!q.quotedAt;
  if (isAmendment) {
    const prevLog = Array.isArray(q.amendments) ? q.amendments : [];
    const rev = (q.revision || 0) + 1;
    data.revision = rev;
    data.amendments = [
      ...prevLog,
      {
        rev,
        byName: user.name,
        at: new Date().toISOString(),
        note: String(body.amendReason || "").trim() || null,
        prevTotal: q.grandTotal,
        grandTotal: totals.grandTotal,
        currency,
      },
    ];
  }
  if (issue) {
    data.status = "QUOTED";
    data.preparedByName = user.name;
    data.quotedAt = new Date();
    // Restart the "still awaiting a decision?" nudge clock on each (re)issue.
    data.followupSentAt = null;
    // Mint the shareable link now so the client can be emailed/messaged the PDF.
    if (!q.shareToken) data.shareToken = crypto.randomBytes(18).toString("base64url");
  }

  const updated = await prisma.quotation.update({ where: { id: q.id }, data });

  await recordAudit({
    actor: user,
    action: "UPDATE",
    entity: "QUOTATION",
    entityId: q.number,
    summary: isAmendment
      ? `Quotation ${q.number} amended to Rev ${updated.revision} by ${user.name} (${currency} ${totals.grandTotal.toLocaleString()})`
      : issue
        ? `Quotation ${q.number} issued (${currency} ${totals.grandTotal.toLocaleString()})`
        : `Quotation ${q.number} draft saved`,
  });

  // On issue, email the client the quote.
  if (issue && updated.contactEmail) {
    try {
      await sendMail(quoteIssuedEmail(updated.contactEmail, updated));
    } catch {
      /* best-effort */
    }
  }

  return Response.json({
    ok: true,
    status: updated.status,
    shareToken: updated.shareToken || null,
    contactEmail: updated.contactEmail || null,
    contactPhone: updated.contactPhone || null,
    number: updated.number,
    grandTotal: updated.grandTotal,
    currency: updated.currency,
  });
}
