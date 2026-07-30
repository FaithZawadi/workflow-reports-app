import { prisma } from "./db";

// Resolve a client by name WITHOUT case sensitivity, so "TATA Chemicals",
// "Tata chemicals" and "tata CHEMICALS" all map to the same client instead of
// creating duplicates. Reactivates a deactivated match. Creates one only when no
// case-insensitive match exists (keeping the caller's original casing).
export async function resolveClientByName(name) {
  const n = String(name || "").trim();
  if (!n) return null;
  const existing = await prisma.client.findFirst({ where: { name: { equals: n, mode: "insensitive" } } });
  if (existing) {
    if (!existing.active) await prisma.client.update({ where: { id: existing.id }, data: { active: true } });
    return existing;
  }
  return prisma.client.create({ data: { name: n } });
}

// Resolve a site by name within a client, case-insensitively, so the same site
// isn't registered twice under different casing. `clientId` may be null for a
// global (client-less) site.
export async function resolveSiteByName(clientId, name) {
  const n = String(name || "").trim();
  if (!n) return null;
  const existing = await prisma.site.findFirst({
    where: { name: { equals: n, mode: "insensitive" }, clientId: clientId ?? null },
  });
  if (existing) {
    if (!existing.active) await prisma.site.update({ where: { id: existing.id }, data: { active: true } });
    return existing;
  }
  return prisma.site.create({ data: { name: n, clientId: clientId ?? null } });
}
