import { prisma } from "@/lib/db";
import { renderQuotationPdf } from "@/lib/quotationPdf";

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

  const buffer = await renderQuotationPdf(q);

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
