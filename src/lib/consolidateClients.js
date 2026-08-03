import { prisma } from "./db";

// Fold spelling/branch variants of a company into ONE canonical client, moving
// each variant's records over and tagging the report/schedule SITE with the
// branch (Magadi / Kajiado / Mombasa) it came from. Result: one "TATA Chemicals"
// client whose reports carry the branch as their site — so the management report
// can show the whole company (client filter) or one branch (site filter).

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const compact = (s) => norm(s).replace(/\s+/g, "");

// Branch (site) inferred from a client-name variant.
function branchOf(name) {
  const n = norm(name);
  if (n.includes("magadi")) return "Magadi";
  if (n.includes("kajiado")) return "Kajiado";
  if (n.includes("mombasa")) return "Mombasa";
  return null;
}

// One entry per real company. `matches` decides which client rows belong to it;
// `branches` are registered as sites under the canonical client.
const GROUPS = [
  {
    canonical: "TATA Chemicals",
    matches: (name) => compact(name).startsWith("tatachemical"),
    branches: ["Magadi", "Kajiado", "Mombasa"],
  },
];

async function foldMember(keeperId, canonical, member) {
  const branch = branchOf(member.name);
  const named = { clientId: keeperId, clientName: canonical };
  const namedBranch = branch ? { ...named, site: branch } : named;
  await prisma.$transaction([
    prisma.report.updateMany({ where: { clientId: member.id }, data: namedBranch }),
    prisma.schedule.updateMany({ where: { clientId: member.id }, data: namedBranch }),
    prisma.task.updateMany({ where: { clientId: member.id }, data: named }),
    prisma.contract.updateMany({ where: { clientId: member.id }, data: named }),
    prisma.calibrationRequest.updateMany({ where: { clientId: member.id }, data: named }),
    prisma.quotation.updateMany({ where: { clientId: member.id }, data: named }),
    prisma.weighbridge.updateMany({ where: { clientId: member.id }, data: { clientId: keeperId } }),
    prisma.site.updateMany({ where: { clientId: member.id }, data: { clientId: keeperId } }),
    prisma.project.updateMany({ where: { clientId: member.id }, data: { clientId: keeperId } }),
    prisma.user.updateMany({ where: { clientId: member.id }, data: { clientId: keeperId } }),
  ]);
}

export async function consolidateClients() {
  let mergedClients = 0;
  let renamed = 0;

  for (const g of GROUPS) {
    const all = await prisma.client.findMany({ include: { _count: { select: { reports: true } } } });
    const members = all.filter((c) => g.matches(c.name));
    if (!members.length) continue;

    // Keep the exact canonical if present, else the one with the most reports.
    members.sort((a, b) => b._count.reports - a._count.reports);
    const keeper = members.find((c) => norm(c.name) === norm(g.canonical)) || members[0];

    if (keeper.name !== g.canonical) {
      const clash = await prisma.client.findFirst({ where: { name: g.canonical, id: { not: keeper.id } } });
      // If a same-named canonical already exists it will be in `members`; otherwise rename.
      if (!clash) {
        await prisma.client.update({ where: { id: keeper.id }, data: { name: g.canonical, active: true } });
        renamed += 1;
      }
    }

    // Re-tag EVERY member's reports (branch as site + canonical name), then delete
    // the duplicates. The keeper's own records get re-tagged too (id unchanged).
    for (const m of members) {
      await foldMember(keeper.id, g.canonical, m);
      if (m.id !== keeper.id) {
        await prisma.client.delete({ where: { id: m.id } });
        mergedClients += 1;
      }
    }

    // Register the branches as sites so the branch filter has options.
    for (const branch of g.branches) {
      const exists = await prisma.site.findFirst({ where: { clientId: keeper.id, name: { equals: branch, mode: "insensitive" } } });
      if (!exists) await prisma.site.create({ data: { name: branch, clientId: keeper.id } });
    }
  }

  return { mergedClients, renamed };
}
