import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/health — liveness + database reachability. Used by Render's
// health check and by local monitoring.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: true, time: new Date().toISOString() });
  } catch {
    return Response.json({ ok: false, db: false }, { status: 503 });
  }
}
