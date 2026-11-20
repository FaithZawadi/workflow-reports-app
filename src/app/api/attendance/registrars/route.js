import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageAttendance } from "@/lib/roles";
import { attendanceVisibility } from "@/lib/attendanceScope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/attendance/registrars — the personnel who registered workers, for the
// "Registered by" filter. Admins get everyone who has registered a worker; any
// other manager only ever sees themselves (they can't see others' workers).
export async function GET() {
  let user;
  try {
    user = await requireUser();
    if (!canManageAttendance(user)) return Response.json({ error: "Not allowed." }, { status: 403 });
  } catch (res) {
    return res;
  }
  const { admin, myId } = attendanceVisibility(user);
  if (!admin) return Response.json({ registrars: [{ id: myId, name: user.name || "Me" }] });

  const rows = await prisma.worker.findMany({
    where: { registeredById: { not: null } },
    select: { registeredById: true, registeredByName: true },
    distinct: ["registeredById"],
    orderBy: { registeredByName: "asc" },
  });
  const registrars = rows
    .filter((r) => r.registeredById)
    .map((r) => ({ id: r.registeredById, name: r.registeredByName || "—" }));
  return Response.json({ registrars });
}
