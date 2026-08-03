import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { consolidateClients } from "@/lib/consolidateClients";

// POST /api/clients/consolidate  (admin only)
// Fold known spelling/branch variants of a company (e.g. every "Tatachemical…"
// row) into ONE canonical client, tagging each report/schedule SITE with its
// branch (Magadi / Kajiado / Mombasa) and registering those branches as sites.
// Idempotent — safe to run repeatedly. Runs on demand from the admin UI because
// the deploy pipeline does not run the seed.
export async function POST() {
  let user;
  try {
    user = await requireUser(["ADMIN"]);
  } catch (res) {
    return res;
  }

  const { mergedClients, renamed } = await consolidateClients();

  if (mergedClients || renamed) {
    await recordAudit({
      actor: user,
      action: "UPDATE",
      entity: "CLIENT",
      entityId: "consolidate",
      summary: `Consolidated client duplicates (${mergedClients} merged, ${renamed} renamed)`,
    });
  }

  return Response.json({ ok: true, mergedClients, renamed });
}
