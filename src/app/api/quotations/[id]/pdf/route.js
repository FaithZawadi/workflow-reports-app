import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isClient } from "@/lib/roles";
import { renderQuotationPdf } from "@/lib/quotationPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/quotations/[id]/pdf — the quotation as a PDF. Reached by capability
// URL (the id is an unguessable cuid) so it can be shared with the client as a
// document — the recipient opens the PDF directly, no QSL login required. This
// mirrors the customer survey / training feedback PDFs.
export async function GET(_req, { params }) {
  const q = await prisma.quotation.findUnique({ where: { id: params.id } });
  if (!q) return Response.json({ error: "Not found." }, { status: 404 });

  // ?download=1 forces a file download (used by the "Send to client" panel so the
  // preparer can attach the PDF to WhatsApp); default is inline view.
  const download = new URL(_req.url).searchParams.get("download");

  // Amendment history is internal-only: include it only for an authenticated QSL
  // staff session (never for a client, and never when opened without login).
  const viewer = await getCurrentUser().catch(() => null);
  const internal = !!viewer && !isClient(viewer);
  const buffer = await renderQuotationPdf(q, { internal });

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${q.number}.pdf"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
