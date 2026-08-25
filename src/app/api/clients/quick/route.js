import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { canFileReports } from "@/lib/roles";
import { resolveSiteByName } from "@/lib/clientResolve";
import { siteDetailData } from "@/lib/clientFields";

export const dynamic = "force-dynamic";

// POST /api/clients/quick — a technician adds a brand-new client (and optional
// site) while filing a report, without any other admin access. The client must
// be NEW: if one already exists with that name in ANY casing, we refuse and
// point them at the existing record instead of creating a duplicate.
export async function POST(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canFileReports(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  if (!name) return Response.json({ error: "Enter the new client's name." }, { status: 400 });

  // Only-new rule: reject a case-insensitive match against any existing client.
  const clash = await prisma.client.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (clash) {
    return Response.json(
      { error: `“${clash.name}” already exists — pick it from the client list instead of adding it again.`, existing: { id: clash.id, name: clash.name } },
      { status: 409 }
    );
  }

  const client = await prisma.client.create({ data: { name }, select: { id: true, name: true } });
  await recordAudit({ actor: user, action: "CREATE", entity: "CLIENT", entityId: client.id, summary: `Client ${client.name} added by ${user.name} while filing a report` });

  // Optional site for the new client (with any GPS / geofence details).
  let site = null;
  const siteName = String(b.site || "").trim();
  if (siteName) {
    let s = await resolveSiteByName(client.id, siteName);
    const detail = siteDetailData(b);
    if (Object.keys(detail).length) s = await prisma.site.update({ where: { id: s.id }, data: detail });
    site = s.name;
    await recordAudit({ actor: user, action: "CREATE", entity: "SITE", entityId: s.id, summary: `Site ${s.name} added under ${client.name} by ${user.name}` });
  }

  return Response.json({ client, site });
}
