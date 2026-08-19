import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { QuotationDocument } from "@/pdf/QuotationDocument";
import { logoDataUrl } from "@/lib/logo";
import { qrDataUrl } from "@/lib/qr";
import { getCurrentUser } from "@/lib/auth";
import { isClient } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/quotations/[id]/pdf — the quotation as a PDF. Reached by capability
// URL (the id is an unguessable cuid) so it can be shared with the client as a
// document — the recipient opens the PDF directly, no QSL login required. This
// mirrors the customer survey / training feedback PDFs.
export async function GET(_req, { params }) {
  const q = await prisma.quotation.findUnique({ where: { id: params.id } });
  if (!q) return Response.json({ error: "Not found." }, { status: 404 });

  const qrText = [
    `QSL Quotation ${q.number}`,
    `Client: ${q.clientName}`,
    `Total: ${q.currency} ${Number(q.grandTotal || 0).toLocaleString()}`,
    q.validUntil ? `Valid until ${new Date(q.validUntil).toLocaleDateString()}` : null,
  ].filter(Boolean).join("\n");
  const qrSrc = await qrDataUrl(qrText);
  // Amendment history is internal-only: include it only for an authenticated QSL
  // staff session (never for a client, and never when opened without login).
  const viewer = await getCurrentUser().catch(() => null);
  const internal = !!viewer && !isClient(viewer);
  const buffer = await renderToBuffer(React.createElement(QuotationDocument, { quotation: q, logoSrc: logoDataUrl(), qrSrc, internal }));

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${q.number}.pdf"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
