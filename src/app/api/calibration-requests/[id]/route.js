import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { rolesOf, canPrepareQuotes, isClient } from "@/lib/roles";
import { sendMail, calibrationDecisionEmail } from "@/lib/email";

// A client may view their own; PM/TM/admin may view any.
function canView(user, reqRow) {
  const roles = rolesOf(user);
  if (roles.includes("ADMIN") || canPrepareQuotes(user)) return true;
  if (isClient(user)) return reqRow.requestedById === user.sub || (user.clientId && reqRow.clientId === user.clientId);
  return false;
}

export async function GET(_req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const request = await prisma.calibrationRequest.findUnique({ where: { id: params.id } });
  if (!request) return Response.json({ error: "Not found." }, { status: 404 });
  if (!canView(user, request)) return Response.json({ error: "Not allowed." }, { status: 403 });
  return Response.json({ request, canReview: canPrepareQuotes(user) || rolesOf(user).includes("ADMIN") });
}

// PATCH — the QSL laboratory (PM / TM) completes the review checklist and
// records the accept / reject decision.
export async function PATCH(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!(canPrepareQuotes(user) || rolesOf(user).includes("ADMIN")))
    return Response.json({ error: "Only the QSL laboratory can review a request." }, { status: 403 });

  const request = await prisma.calibrationRequest.findUnique({ where: { id: params.id } });
  if (!request) return Response.json({ error: "Not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const decision = body.status === "ACCEPTED" || body.status === "REJECTED" ? body.status : null;

  const data = {};
  if (body.reviewChecklist && typeof body.reviewChecklist === "object") data.reviewChecklist = body.reviewChecklist;
  if (decision) {
    if (decision === "REJECTED" && !String(body.decisionReason || "").trim())
      return Response.json({ error: "A reason is required to reject." }, { status: 400 });
    data.status = decision;
    data.decisionReason = String(body.decisionReason || "").trim() || null;
    data.reviewedByName = user.name;
    data.approvedByName = decision === "ACCEPTED" ? user.name : null;
    data.reviewedAt = new Date();
  }

  const updated = await prisma.calibrationRequest.update({ where: { id: params.id }, data });

  await recordAudit({
    actor: user,
    action: "UPDATE",
    entity: "CALIBRATION_REQUEST",
    entityId: updated.serial,
    summary: decision
      ? `Calibration request ${updated.serial} ${decision.toLowerCase()}${data.decisionReason ? ` — "${data.decisionReason}"` : ""}`
      : `Calibration request ${updated.serial} review updated`,
  });

  // Tell the client the outcome.
  if (decision && updated.email) {
    try {
      await sendMail(calibrationDecisionEmail(updated.email, updated, decision));
    } catch {
      // best-effort
    }
  }

  return Response.json({ ok: true, status: updated.status });
}
