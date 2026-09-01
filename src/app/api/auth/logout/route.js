import { getCurrentUser, endSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export async function POST() {
  // Capture who signed out before the session is cleared.
  const claims = await getCurrentUser().catch(() => null);
  if (claims) {
    await recordAudit({
      actor: { sub: claims.sub, name: claims.name, role: claims.role },
      action: "LOGOUT", entity: "AUTH", entityId: claims.sub,
      summary: `${claims.name || claims.email || "A user"} signed out`,
    });
  }
  endSession();
  return Response.json({ ok: true });
}
