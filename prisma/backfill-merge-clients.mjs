// One-time, idempotent client de-duplication. Merges known duplicate client
// records into a single canonical client: re-points every reference and renames
// the denormalised clientName snapshots, then deletes the emptied duplicates.
//
// Safe to run repeatedly — once a group has collapsed to one client there is
// nothing left to merge. Called from prisma/seed.mjs (runs on every deploy) and
// runnable directly: `node prisma/backfill-merge-clients.mjs`.
//
// Add more groups over time as duplicates are spotted. `match` values are
// compared case-insensitively with collapsed whitespace, so "TATA Chemicals
// Magadi", "Tata Chemical Magadi" and "Tatachemical  magadi" all match.

const GROUPS = [
  {
    canonical: "Tata Chemicals Magadi",
    match: ["tata chemicals magadi", "tata chemical magadi", "tatachemical magadi"],
  },
  {
    canonical: "Tata Chemicals Kajiado",
    match: ["tata chemicals kajiado", "tata chemical kajiado", "tatachemical kajiado"],
  },
];

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

async function mergeInto(prisma, keeperId, keeperName, sourceId) {
  const named = { clientId: keeperId, clientName: keeperName };
  const idOnly = { clientId: keeperId };
  await prisma.$transaction([
    prisma.report.updateMany({ where: { clientId: sourceId }, data: named }),
    prisma.schedule.updateMany({ where: { clientId: sourceId }, data: named }),
    prisma.task.updateMany({ where: { clientId: sourceId }, data: named }),
    prisma.contract.updateMany({ where: { clientId: sourceId }, data: named }),
    prisma.calibrationRequest.updateMany({ where: { clientId: sourceId }, data: named }),
    prisma.quotation.updateMany({ where: { clientId: sourceId }, data: named }),
    prisma.weighbridge.updateMany({ where: { clientId: sourceId }, data: idOnly }),
    prisma.site.updateMany({ where: { clientId: sourceId }, data: idOnly }),
    prisma.project.updateMany({ where: { clientId: sourceId }, data: idOnly }),
    prisma.user.updateMany({ where: { clientId: sourceId }, data: idOnly }),
    prisma.client.delete({ where: { id: sourceId } }),
  ]);
}

export async function backfillMergeClients(prisma) {
  let mergedClients = 0;
  for (const group of GROUPS) {
    const set = new Set(group.match.map(norm));
    const all = await prisma.client.findMany({ include: { _count: { select: { reports: true } } } });
    const members = all.filter((c) => set.has(norm(c.name)));
    if (members.length < 2) {
      // Nothing to merge, but still normalise the keeper's name if present.
      const keeper = members[0];
      if (keeper && keeper.name !== group.canonical) {
        const clash = await prisma.client.findFirst({ where: { name: group.canonical, id: { not: keeper.id } } });
        if (!clash) await prisma.client.update({ where: { id: keeper.id }, data: { name: group.canonical } });
      }
      continue;
    }
    // Keep the client with the most reports; rename it to the canonical name.
    members.sort((a, b) => b._count.reports - a._count.reports);
    const keeper = members[0];
    if (keeper.name !== group.canonical) {
      await prisma.client.update({ where: { id: keeper.id }, data: { name: group.canonical, active: true } });
    }
    for (const src of members.slice(1)) {
      await mergeInto(prisma, keeper.id, group.canonical, src.id);
      mergedClients += 1;
    }
  }
  return mergedClients;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const n = await backfillMergeClients(prisma);
    console.log(`Client merge backfill: ${n} duplicate client(s) merged.`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
