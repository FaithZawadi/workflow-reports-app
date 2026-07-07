import { requireUser } from "@/lib/auth";
import { buildSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";

// GET /api/schedule — maintenance due/overdue board scoped to the caller.
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const items = await buildSchedule(user);
  return Response.json({ items, generatedAt: new Date().toISOString() });
}
