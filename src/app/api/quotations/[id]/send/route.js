import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isClient } from "@/lib/roles";
import { recordAudit } from "@/lib/audit";
import { sendMail } from "@/lib/email";
import { renderQuotationPdf } from "@/lib/quotationPdf";
import { COMPANY } from "@/lib/company";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/quotations/[id]/send — email the quotation PDF straight to the client.
// A deliberate staff action (never automatic): the preparer clicks "Email PDF to
// client" and the client receives the actual PDF attached — no link, no manual
// attaching. WhatsApp can't attach from a URL, so that path still downloads first.
export async function POST(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (isClient(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const q = await prisma.quotation.findUnique({ where: { id: params.id } });
  if (!q) return Response.json({ error: "Not found." }, { status: 404 });
  if (q.status === "REQUESTED") {
    return Response.json({ error: "Prepare and issue the quotation before emailing it." }, { status: 400 });
  }

  // Optional overrides from the panel; default to the client contact on file.
  const body = await req.json().catch(() => ({}));
  const to = String(body.to || q.contactEmail || "").trim();
  const cc = String(body.cc || "").trim();
  if (!to) {
    return Response.json({ error: "No client email on file — add one under Client contact, or download the PDF and send it yourself." }, { status: 400 });
  }

  let buffer;
  try {
    buffer = await renderQuotationPdf(q, { internal: false });
  } catch {
    return Response.json({ error: "Could not generate the PDF. Try again." }, { status: 500 });
  }

  const money = `${q.currency} ${Number(q.grandTotal || 0).toLocaleString()}`;
  const validLine = q.validUntil ? `, valid until ${new Date(q.validUntil).toLocaleDateString()}` : "";
  const senderName = user?.name || COMPANY.name;
  const text = `Dear ${q.contactPerson || "Sir/Madam"},

Please find attached our quotation ${q.number} for ${q.clientName}. Total ${money}${validLine}.

Kind regards,
${senderName}
${COMPANY.name}`;

  // Send as the preparer, not the system mailbox: their name + email is the
  // visible From and Reply-To, so the client replies straight to them. (The SMTP
  // envelope sender stays on the authenticated account for deliverability.)
  const fromHeader = user?.email ? `${senderName} <${user.email}>` : undefined;

  const res = await sendMail({
    to,
    cc: cc || undefined,
    from: fromHeader,
    replyTo: user?.email || undefined,
    subject: `Quotation ${q.number} — ${COMPANY.name}`,
    text,
    attachments: [{ filename: `${q.number}.pdf`, content: buffer, contentType: "application/pdf" }],
  });

  if (!res.sent) {
    const reason = res.reason || "email not configured";
    return Response.json(
      { error: `Couldn't send the email (${reason}). Enable email in System Settings → Workflow, or download the PDF and send it yourself.` },
      { status: 400 },
    );
  }

  await recordAudit({
    actor: user,
    action: "SEND",
    entity: "QUOTATION",
    entityId: q.id,
    summary: `Quotation ${q.number} emailed to ${to} by ${user.name}`,
  }).catch(() => {});

  return Response.json({ ok: true, to });
}
