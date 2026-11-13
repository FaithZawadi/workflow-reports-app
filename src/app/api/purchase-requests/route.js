import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { nextSerial } from "@/lib/serial";
import { recordAudit } from "@/lib/audit";
import { rolesOf, PR_CREATE_ROLES, PR_REVIEW_ROLES } from "@/lib/roles";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const canCreate = (user) => rolesOf(user).some((r) => PR_CREATE_ROLES.includes(r));
const canReview = (user) => rolesOf(user).some((r) => PR_REVIEW_ROLES.includes(r));

function cleanItems(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((it) => ({
      description: String(it.description || "").trim(),
      qty: Number(it.qty) || 0,
      unit: String(it.unit || "EA").trim() || "EA",
      estUnitPrice: Number(it.estUnitPrice) || 0,
    }))
    .filter((it) => it.description);
}
const estTotalOf = (items) => items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.estUnitPrice) || 0), 0);

// GET /api/purchase-requests?status=&q= — reviewers see all; everyone else sees
// only the requests they raised.
export async function GET(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canCreate(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = (searchParams.get("q") || "").trim();
  const where = { AND: [] };
  if (!canReview(user)) where.AND.push({ requestedById: user.sub || "__none__" });
  if (status && status !== "all") where.AND.push({ status });
  if (q) {
    where.AND.push({
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { suggestedSupplier: { contains: q, mode: "insensitive" } },
        { requestedByName: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const requests = await prisma.purchaseRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return Response.json({ requests, canReview: canReview(user) });
}

// POST /api/purchase-requests — raise a purchase request.
export async function POST(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canCreate(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const items = cleanItems(body.items);
  if (items.length === 0) return Response.json({ error: "Add at least one item you need." }, { status: 400 });

  const settings = await getSettings();
  const currency = String(body.currency || settings.finance?.currency || "KES");
  const number = await nextSerial("PR");

  const toDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d) ? null : d;
  };

  const created = await prisma.purchaseRequest.create({
    data: {
      number,
      status: "PENDING",
      requestedByName: user.name,
      requestedById: user.sub || null,
      title: String(body.title || "").trim() || null,
      justification: String(body.justification || "").trim() || null,
      items,
      suggestedSupplier: String(body.suggestedSupplier || "").trim() || null,
      requiredBy: toDate(body.requiredBy),
      currency,
      estTotal: Math.round(estTotalOf(items) * 100) / 100,
    },
  });

  await recordAudit({
    actor: user,
    action: "CREATE",
    entity: "PURCHASE_REQUEST",
    entityId: created.number,
    summary: `Purchase request ${created.number} raised by ${user.name}`,
  });

  return Response.json({ id: created.id, number: created.number });
}
