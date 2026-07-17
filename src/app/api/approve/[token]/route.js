import { inspectToken, consumeToken } from "@/lib/approvalToken";
import { applyDecision } from "@/lib/decision";

const REASON_TEXT = {
  missing: "This link is missing its token.",
  invalid: "This approval link is not valid.",
  used: "This approval link has already been used.",
  expired: "This approval link has expired.",
  stale: "This report has already moved past this step.",
};

// GET — the landing page fetches the report summary to show before acting.
export async function GET(_req, { params }) {
  const check = await inspectToken(params.token);
  if (!check.ok) {
    return Response.json(
      { ok: false, reason: check.reason, message: REASON_TEXT[check.reason] || "This link can't be used." },
      { status: 200 }
    );
  }
  const r = check.report;
  return Response.json({
    ok: true,
    stage: check.row.stage, // SUPERVISOR | MANAGER
    report: {
      serial: r.serial,
      template: r.template,
      templateName: r.templateName,
      status: r.status,
      clientName: r.clientName,
      site: r.site,
      weighbridgeId: r.weighbridgeId,
      authorName: r.authorName,
      supervisorEmail: r.supervisorEmail,
      managerEmail: r.managerEmail,
      createdAt: r.createdAt,
      data: r.data,
      photos: (r.photos || []).map((p) => ({
        dataUrl: p.dataUrl,
        caption: p.caption,
        gpsLat: p.gpsLat,
        gpsLng: p.gpsLng,
      })),
      trailEvents: (r.trailEvents || []).map((t) => ({ action: t.action, byName: t.byName, comment: t.comment, at: t.at })),
    },
  });
}

// POST — perform the approve/reject. The token authenticates the routed reviewer,
// so no session is required. Single-use: consumed atomically before acting.
export async function POST(req, { params }) {
  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const decision = body.decision === "reject" ? "reject" : "approve";
  const comment = String(body.comment || "").trim();
  if (decision === "reject" && !comment)
    return Response.json({ error: "A comment is required to reject." }, { status: 400 });

  const consumed = await consumeToken(params.token);
  if (!consumed.ok)
    return Response.json({ error: REASON_TEXT[consumed.reason] || "This link can't be used." }, { status: 410 });

  // The reviewer's name comes from the routed email (resolved to a user if one
  // exists; otherwise the email itself is shown on the trail).
  const email = consumed.row.email;
  const { prisma } = await import("@/lib/db");
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, role: true } });
  const actor = { name: u?.name || email, sub: u?.id, role: u?.role };

  const result = await applyDecision({
    report: consumed.report,
    stage: consumed.row.stage,
    decision,
    comment,
    actor,
  });

  return Response.json({ ok: true, ...result });
}
