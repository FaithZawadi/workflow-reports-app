import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { rolesOf, MANAGER_ROLES } from "@/lib/roles";
import { renderInvoicePdf } from "@/lib/invoicePdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FINANCE_ROLES = [...MANAGER_ROLES, "ADMIN"];

// GET /api/invoices/[id]/pdf — the invoice as a PDF (staff only). ?download=1
// forces a file download; default is inline view.
export async function GET(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!rolesOf(user).some((r) => FINANCE_ROLES.includes(r))) {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }
  const inv = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!inv) return Response.json({ error: "Not found." }, { status: 404 });

  const download = new URL(req.url).searchParams.get("download");
  const buffer = await renderInvoicePdf(inv);

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${inv.number}.pdf"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
