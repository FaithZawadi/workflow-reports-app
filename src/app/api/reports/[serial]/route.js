import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canView, canAct } from "@/lib/rbac";

export async function GET(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }

  const report = await prisma.report.findUnique({
    where: { serial: params.serial },
    include: {
      photos: { orderBy: { order: "asc" } },
      trailEvents: { orderBy: { at: "asc" } },
    },
  });

  if (!report) return Response.json({ error: "Report not found." }, { status: 404 });
  if (!canView(report, user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  return Response.json({
    report,
    permissions: { actAs: canAct(report, user) }, // "SUPERVISOR" | "MANAGER" | null
  });
}
