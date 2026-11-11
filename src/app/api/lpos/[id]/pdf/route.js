import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { rolesOf, LPO_ROLES } from "@/lib/roles";
import { renderLpoPdf } from "@/lib/lpoPdf";
import { syncCompany } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/lpos/[id]/pdf — the purchase order as a PDF (staff only). ?download=1
// forces a file download; default is inline view.
export async function GET(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!rolesOf(user).some((r) => LPO_ROLES.includes(r))) {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }
  const lpo = await prisma.lpo.findUnique({ where: { id: params.id } });
  if (!lpo) return Response.json({ error: "Not found." }, { status: 404 });

  const download = new URL(req.url).searchParams.get("download");
  await syncCompany();
  const buffer = await renderLpoPdf(lpo);

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${lpo.number}.pdf"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
