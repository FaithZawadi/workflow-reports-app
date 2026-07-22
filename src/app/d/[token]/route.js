import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { QuotationDocument } from "@/pdf/QuotationDocument";
import { logoDataUrl } from "@/lib/logo";
import { qrDataUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /d/[token] — the opaque public share link for a quotation. The token is an
// unguessable random slug (minted lazily when staff first open the quote), so the
// URL reveals neither the record id nor the /api/quotations path — it just says
// "a document". Resolving the token serves the same quotation PDF the client would
// otherwise download; no QSL login is required.
export async function GET(_req, { params }) {
  const token = String(params.token || "");
  if (!token) return Response.json({ error: "Not found." }, { status: 404 });

  const q = await prisma.quotation.findUnique({ where: { shareToken: token } });
  if (!q) return Response.json({ error: "Not found." }, { status: 404 });

  const qrText = [
    `QSL Quotation ${q.number}`,
    `Client: ${q.clientName}`,
    `Total: ${q.currency} ${Number(q.grandTotal || 0).toLocaleString()}`,
    q.validUntil ? `Valid until ${new Date(q.validUntil).toLocaleDateString()}` : null,
  ].filter(Boolean).join("\n");
  const qrSrc = await qrDataUrl(qrText);
  const buffer = await renderToBuffer(
    React.createElement(QuotationDocument, { quotation: q, logoSrc: logoDataUrl(), qrSrc })
  );

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${q.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
