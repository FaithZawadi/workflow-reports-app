// One-time, idempotent backfill for the single-stage approval change.
//
// Daily / weekly / monthly forms (WB01/WB02/WB03) no longer have a separate
// manager stage — the first approver (the "Client") fully approves the report.
// Any of these reports that already reached PENDING_MANAGER means their approver
// had signed off under the old two-stage flow, so they should now read APPROVED.
// Reports still at PENDING_SUPERVISOR are left as-is (still awaiting the Client).
//
// Safe to run repeatedly: once a report is APPROVED it no longer matches the
// filter, so a second run is a no-op. Called from prisma/seed.mjs (runs on every
// deploy) and can also be run directly: `node prisma/backfill-single-approval.mjs`.

const SINGLE_APPROVAL_TEMPLATES = ["WB01", "WB02", "WB03"];

export async function backfillSingleApproval(prisma) {
  const targets = await prisma.report.findMany({
    where: { template: { in: SINGLE_APPROVAL_TEMPLATES }, status: "PENDING_MANAGER" },
    select: { serial: true },
  });
  if (!targets.length) return 0;

  for (const r of targets) {
    await prisma.report.update({
      where: { serial: r.serial },
      data: {
        status: "APPROVED",
        trailEvents: {
          create: [
            {
              action: "Approved",
              byName: "System",
              comment:
                "Daily/weekly/monthly reports now use single Client approval; this report had already passed its approver, so it is marked Approved.",
            },
          ],
        },
      },
    });
  }
  return targets.length;
}

// Run standalone when invoked directly (not when imported by the seed).
if (import.meta.url === `file://${process.argv[1]}`) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const n = await backfillSingleApproval(prisma);
    console.log(`Single-approval backfill: ${n} report(s) updated to APPROVED.`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
