import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { rolesOf, PR_CREATE_ROLES, PR_REVIEW_ROLES } from "@/lib/roles";
import { renderMrfPdf } from "@/lib/mrfPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const canSee = (user) => rolesOf(user).some((r) => PR_CREATE_ROLES.includes(r));
const canReview = (user) => rolesOf(user).some((r) => PR_REVIEW_ROLES.includes(r));

// GET /api/purchase-requests/[id]/mrf — the QSL-A2 Material Requisition Form PDF.
export async function GET(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canSee(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const request = await prisma.purchaseRequest.findUnique({ where: { id: params.id } });
  if (!request) return Response.json({ error: "Request not found." }, { status: 404 });
  if (!canReview(user) && request.requestedById !== user.sub) {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

  const download = new URL(req.url).searchParams.get("download");
  const buffer = await renderMrfPdf(request);

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="MRF-${request.number}.pdf"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
