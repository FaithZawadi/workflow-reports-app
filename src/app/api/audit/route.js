import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Auth-gated, per-request — never statically prerendered.
export const dynamic = "force-dynamic";

// GET /api/audit?entity=&action=&q= — administrators only.
export async function GET(req) {
  try {
    await requireUser(["ADMIN"]);
  } catch (res) {
    return res;
  }

  const { searchParams } = new URL(req.url);
  const entity = searchParams.get("entity");
  const action = searchParams.get("action");
  const q = (searchParams.get("q") || "").trim();

  const where = { AND: [] };
  if (entity && entity !== "all") where.AND.push({ entity });
  if (action && action !== "all") where.AND.push({ action });
  if (q) {
    where.AND.push({
      OR: [
        { actorName: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        { entityId: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const logs = await prisma.auditLog.findMany({
    where: where.AND.length ? where : {},
    orderBy: { at: "desc" },
    take: 500,
  });

  return Response.json({ logs });
}
