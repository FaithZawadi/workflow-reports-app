import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

// POST /api/clients/[id]/merge  { into: <targetClientId> }
// Fold a duplicate client (source = [id]) into a canonical one (target = into):
// re-point every reference and rename the denormalised clientName snapshots to
// the target's name, then delete the source. Admin only. Idempotent-ish: once
// the source is gone a repeat call 404s.
export async function POST(req, { params }) {
  let user;
  try {
    user = await requireUser(["ADMIN"]);
  } catch (res) {
    return res;
  }

  const sourceId = params.id;
  const { into } = await req.json().catch(() => ({}));
  if (!into) return Response.json({ error: "Choose a client to merge into." }, { status: 400 });
  if (into === sourceId) return Response.json({ error: "Can't merge a client into itself." }, { status: 400 });

  const [source, target] = await Promise.all([
    prisma.client.findUnique({ where: { id: sourceId } }),
    prisma.client.findUnique({ where: { id: into } }),
  ]);
  if (!source) return Response.json({ error: "Source client not found." }, { status: 404 });
  if (!target) return Response.json({ error: "Target client not found." }, { status: 404 });

  const named = { clientId: into, clientName: target.name };
  const idOnly = { clientId: into };

  const [reports, schedules, tasks, contracts, calibrations, quotations] = await prisma.$transaction([
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

  const moved = reports.count + schedules.count + tasks.count + contracts.count + calibrations.count + quotations.count;
  await recordAudit({
    actor: user,
    action: "UPDATE",
    entity: "CLIENT",
    entityId: into,
    summary: `Merged "${source.name}" into "${target.name}" (${moved} record${moved === 1 ? "" : "s"} re-pointed)`,
  });

  return Response.json({ ok: true, into, movedReports: reports.count, moved });
}
