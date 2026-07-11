import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { TASK_MANAGER_ROLES, canManageTasks } from "@/lib/roles";
import { daysBetween } from "@/lib/contracts";

export const dynamic = "force-dynamic";

const FREQS = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM"];

const shape = (c) => ({
  id: c.id,
  name: c.name,
  client: c.client?.name || c.clientName || null,
  clientId: c.clientId,
  clientName: c.clientName,
  clientEmail: c.clientEmail,
  technicalManagerEmail: c.technicalManagerEmail,
  frequency: c.frequency,
  intervalDays: c.intervalDays,
  startDate: c.startDate,
  endDate: c.endDate,
  nextServiceAt: c.nextServiceAt,
  lastServiceAt: c.lastServiceAt,
  active: c.active,
  notes: c.notes,
  daysUntil: daysBetween(new Date(), c.nextServiceAt),
});

// GET /api/contracts — managers/admin see all active + inactive contracts.
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canManageTasks(user)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const list = await prisma.contract.findMany({
    orderBy: [{ active: "desc" }, { nextServiceAt: "asc" }],
    include: { client: { select: { name: true } } },
  });
  return Response.json({ contracts: list.map(shape) });
}

// POST /api/contracts — register a maintenance contract.
export async function POST(req) {
  let user;
  try {
    user = await requireUser(TASK_MANAGER_ROLES);
  } catch (res) {
    return res;
  }
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  const clientName = String(b.clientName || "").trim();
  if (!name) return Response.json({ error: "Contract name is required." }, { status: 400 });
  if (!clientName) return Response.json({ error: "Choose the client (company)." }, { status: 400 });
  const next = b.nextServiceAt ? new Date(b.nextServiceAt) : null;
  if (!next || isNaN(next)) return Response.json({ error: "Enter the next service date." }, { status: 400 });

  const client = await prisma.client.upsert({ where: { name: clientName }, create: { name: clientName }, update: {} });
  const frequency = FREQS.includes(b.frequency) ? b.frequency : "QUARTERLY";

  const c = await prisma.contract.create({
    data: {
      name,
      clientId: client.id,
      clientName,
      clientEmail: String(b.clientEmail || "").trim() || null,
      technicalManagerEmail: String(b.technicalManagerEmail || "").trim() || null,
      frequency,
      intervalDays: frequency === "CUSTOM" ? Number(b.intervalDays) || 30 : null,
      startDate: b.startDate ? new Date(b.startDate) : null,
      endDate: b.endDate ? new Date(b.endDate) : null,
      nextServiceAt: next,
      notes: String(b.notes || "").trim() || null,
    },
  });
  await recordAudit({ actor: user, action: "CREATE", entity: "CONTRACT", entityId: c.id, summary: `Registered contract ${name} for ${clientName}` });
  return Response.json({ contract: shape({ ...c, client: { name: clientName } }) });
}
