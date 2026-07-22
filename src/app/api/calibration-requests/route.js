import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { nextSerial } from "@/lib/serial";
import { recordAudit } from "@/lib/audit";
import { rolesOf, canPrepareQuotes, isClient, isSupervisor } from "@/lib/roles";
import { assignedClientIds } from "@/lib/rbac";
import { sendMail, calibrationRequestEmail } from "@/lib/email";
import { notifyEmails, oversight } from "@/lib/notify";

// Who may see the calibration-request area at all, and the scope of what they see.
async function scopeFor(user) {
  const roles = rolesOf(user);
  if (roles.includes("ADMIN") || canPrepareQuotes(user)) return {}; // PM/TM/admin: all
  if (isClient(user)) {
    // A client sees only their own company's requests.
    return user.clientId ? { clientId: user.clientId } : { requestedById: user.sub };
  }
  if (isSupervisor(user)) {
    // Equipment User: read-only, scoped to their weighbridges' clients.
    const ids = await assignedClientIds(user);
    return ids.length ? { clientId: { in: ids } } : { id: "__none__" };
  }
  return null; // no access
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

  const requests = await prisma.calibrationRequest.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      serial: true,
      clientName: true,
      status: true,
      equipment: true,
      calibrationType: true,
      preferredDate: true,
      createdAt: true,
    },
  });
  return Response.json({ requests });
}

export async function POST(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  // Clients file their own; PM/TM/admin may file on a client's behalf.
  const roles = rolesOf(user);
  if (!(isClient(user) || canPrepareQuotes(user) || roles.includes("ADMIN")))
    return Response.json({ error: "Not allowed." }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  // Resolve the client (plant). A client user is tied to their own; staff pick one.
  let clientId = null;
  let clientName = String(body.clientName || "").trim();
  if (isClient(user) && user.clientId) {
    const c = await prisma.client.findUnique({ where: { id: user.clientId } });
    clientId = user.clientId;
    clientName = c?.name || clientName;
  } else if (clientName) {
    const c = await prisma.client.upsert({ where: { name: clientName }, create: { name: clientName }, update: {} });
    clientId = c.id;
  }
  if (!clientName) return Response.json({ error: "Client name is required." }, { status: 400 });

  // Equipment rows — keep only rows that name a piece of equipment.
  const equipment = (Array.isArray(body.equipment) ? body.equipment : [])
    .map((r) => ({
      name: String(r?.name || "").trim(),
      makeModel: String(r?.makeModel || "").trim(),
      serialNo: String(r?.serialNo || "").trim(),
      capacity: String(r?.capacity || "").trim(),
      division: String(r?.division || "").trim(),
      location: String(r?.location || "").trim(),
      remarks: String(r?.remarks || "").trim(),
    }))
    .filter((r) => r.name)
    .slice(0, 20);
  if (equipment.length === 0)
    return Response.json({ error: "Add at least one instrument to calibrate." }, { status: 400 });

  const calibrationType = body.calibrationType === "IN_SITU" || body.calibrationType === "LAB" ? body.calibrationType : null;
  const preferredDate = body.preferredDate ? new Date(body.preferredDate) : null;

  const serial = await nextSerial("CRF");
  const created = await prisma.calibrationRequest.create({
    data: {
      serial,
      clientId,
      clientName,
      contactPerson: String(body.contactPerson || "").trim() || user.name || null,
      address: String(body.address || "").trim() || null,
      telephone: String(body.telephone || "").trim() || null,
      email: String(body.email || "").trim() || user.email || null,
      equipment,
      calibrationType,
      preferredDate: preferredDate && !isNaN(preferredDate) ? preferredDate : null,
      additionalRequests: String(body.additionalRequests || "").trim() || null,
      declarationName: String(body.declarationName || "").trim() || user.name || null,
      declarationDesignation: String(body.declarationDesignation || "").trim() || null,
      declarationDate: new Date(),
      status: "SUBMITTED",
      requestedById: user.sub,
      requestedByName: user.name,
    },
  });

  await recordAudit({
    actor: user,
    action: "CREATE",
    entity: "CALIBRATION_REQUEST",
    entityId: created.serial,
    summary: `Calibration request ${created.serial} for ${clientName} (${equipment.length} instrument(s))`,
  });

  // Notify the QSL laboratory reviewers (PM/TM) — email + in-app.
  try {
    const reviewers = await prisma.user.findMany({
      where: { active: true, roles: { hasSome: ["PROJECT_MANAGER", "TECHNICAL_MANAGER"] } },
      select: { id: true, email: true },
    });
    const emails = reviewers.map((u) => u.email).filter(Boolean);
    if (emails.length) await sendMail(calibrationRequestEmail(emails.join(", "), created));
    await notifyEmails(emails, {
      type: "SYSTEM",
      title: `Calibration request · ${created.serial}`,
      body: `${clientName} — ${equipment.length} instrument(s) to review`,
      link: `/calibration-requests/${created.id}`,
    });
  } catch {
    // best-effort
  }

  return Response.json({ id: created.id, serial: created.serial });
}
