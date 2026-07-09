import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Auth-gated, per-request — never statically prerendered.
export const dynamic = "force-dynamic";

// GET /api/users/directory — minimal lists of active people for the report
// reviewer pickers and the schedule assignee picker. Any signed-in user may
// read it; only name/email/role are exposed.
export async function GET() {
  try {
    await requireUser();
  } catch (res) {
    return res;
  }

  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  const pick = (roles) => users.filter((u) => roles.includes(u.role));
  return Response.json({
    supervisors: pick(["SUPERVISOR"]),
    managers: pick(["MANAGER"]),
    assignees: pick(["TECHNICIAN", "ENGINEER"]),
  });
}
