import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { QuotationDocument } from "@/pdf/QuotationDocument";
import { logoDataUrl } from "@/lib/logo";
import { qrDataUrl, verifyUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/quotations/[id]/pdf — the quotation as a PDF. Reached by capability
// URL (the id is an unguessable cuid) so it can be shared with the client as a
// document — the recipient opens the PDF directly, no QSL login required. This
// mirrors the customer survey / training feedback PDFs.
export async function GET(_req, { params }) {
  const q = await prisma.quotation.findUnique({ where: { id: params.id } });
  if (!q) return Response.json({ error: "Not found." }, { status: 404 });

  const qrSrc = await qrDataUrl(verifyUrl(`/api/quotations/${q.id}/pdf`));
  const buffer = await renderToBuffer(React.createElement(QuotationDocument, { quotation: q, logoSrc: logoDataUrl(), qrSrc }));

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${q.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
