import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { nextSerial } from "@/lib/serial";
import { recordAudit } from "@/lib/audit";
import { rolesOf, canPrepareQuotes, isClient, isSupervisor, canRaiseOwnQuotes } from "@/lib/roles";
import { assignedClientIds } from "@/lib/rbac";
import { sendMail, quoteRequestEmail } from "@/lib/email";
import { notifyEmails } from "@/lib/notify";
import { getSettings } from "@/lib/settings";

// Returns the Prisma `where` for what a user may READ, or null if no access.
// Equipment Users get a read-only view scoped to their weighbridges' clients.
async function scopeFor(user) {
  const roles = rolesOf(user);
  if (roles.includes("ADMIN") || canPrepareQuotes(user)) return {};
  // A Site Technician / Sales user sees only the quotations they created.
  if (canRaiseOwnQuotes(user)) return { requestedById: user.sub };
  if (isClient(user)) return user.clientId ? { clientId: user.clientId } : { requestedById: user.sub };
  if (isSupervisor(user)) {
    const ids = await assignedClientIds(user);
    return ids.length ? { clientId: { in: ids } } : { id: "__none__" };
  }
  return null;
}

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const scope = await scopeFor(user);
  if (scope === null) return Response.json({ error: "Not allowed." }, { status: 403 });

  const quotations = await prisma.quotation.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      number: true,
      clientName: true,
      subject: true,
      status: true,
      grandTotal: true,
      currency: true,
      createdAt: true,
      quotedAt: true,
      validUntil: true,
    },
  });
  return Response.json({ quotations });
}

// POST — create a quotation shell. A CLIENT raises a request; PM/TM/admin may
// start one for a client (optionally from an accepted calibration request).
export async function POST(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const roles = rolesOf(user);
  if (!(isClient(user) || canPrepareQuotes(user) || roles.includes("ADMIN") || canRaiseOwnQuotes(user)))
    return Response.json({ error: "Not allowed." }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  // Optionally seed from a calibration request.
  let cr = null;
  if (body.calibrationRequestId) {
    cr = await prisma.calibrationRequest.findUnique({ where: { id: String(body.calibrationRequestId) } });
  }

  let clientId = null;
  let clientName = String(body.clientName || cr?.clientName || "").trim();
  if (isClient(user) && user.clientId) {
    const c = await prisma.client.findUnique({ where: { id: user.clientId } });
    clientId = user.clientId;
    clientName = c?.name || clientName;
  } else if (cr?.clientId) {
    clientId = cr.clientId;
  } else if (body.clientId) {
    // Chosen from the registered-clients dropdown.
    const c = await prisma.client.findUnique({ where: { id: String(body.clientId) } });
    if (!c) return Response.json({ error: "That client isn't registered." }, { status: 400 });
    clientId = c.id;
    clientName = c.name;
  } else if (clientName) {
    // Never auto-create a bare client from a quotation. It must already be
    // registered (with its full details) — match case-insensitively or refuse.
    const c = await prisma.client.findFirst({ where: { name: { equals: clientName, mode: "insensitive" } } });
    if (!c) {
      return Response.json(
        { error: `“${clientName}” isn't registered yet. Register the client (with its details) first, then start the quotation.` },
        { status: 400 }
      );
    }
    clientId = c.id;
    clientName = c.name;
  }
  if (!clientName) return Response.json({ error: "Client is required." }, { status: 400 });

  const settings = await getSettings();
  const number = await nextSerial(settings.finance.quotePrefix || "Q");
  const created = await prisma.quotation.create({
    data: {
      number,
      clientId,
      clientName,
      // Seed the finance defaults from System Settings (a quote can override).
      currency: settings.finance.currency || "KES",
      vatRate: settings.finance.vatRate ?? 16,
      // The CLIENT's contact details — do NOT fall back to the signed-in staff.
      contactPerson: String(body.contactPerson || cr?.contactPerson || "").trim() || null,
      contactEmail: String(body.contactEmail || cr?.email || "").trim() || null,
      contactPhone: String(body.contactPhone || cr?.phone || cr?.contactPhone || "").trim() || null,
      subject: String(body.subject || "").trim() || null,
      status: "REQUESTED",
      requestNote: String(body.requestNote || "").trim() || (cr ? `From calibration request ${cr.serial}` : null),
      requestedById: user.sub,
      requestedByName: user.name,
      calibrationRequestId: cr?.id || null,
    },
  });

  await recordAudit({
    actor: user,
    action: "CREATE",
    entity: "QUOTATION",
    entityId: created.number,
    summary: `Quotation ${created.number} ${isClient(user) ? "requested by" : "started by"} ${user.name} for ${clientName}`,
  });

  // If a client raised it, notify PM/TM there's a quote to prepare.
  if (isClient(user)) {
    try {
      const preparers = await prisma.user.findMany({
        where: { active: true, roles: { hasSome: ["PROJECT_MANAGER", "TECHNICAL_MANAGER"] } },
        select: { id: true, email: true },
      });
      const emails = preparers.map((u) => u.email).filter(Boolean);
      if (emails.length) await sendMail(quoteRequestEmail(emails.join(", "), created));
      await notifyEmails(emails, {
        type: "SYSTEM",
        title: `Quote requested · ${created.number}`,
        body: `${clientName} requested a quotation`,
        link: `/quotations/${created.id}`,
      });
    } catch {
      // best-effort
    }
  }

  return Response.json({ id: created.id, number: created.number });
}
