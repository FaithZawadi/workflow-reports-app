import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canView } from "@/lib/rbac";
import { rolesOf, MANAGER_ROLES } from "@/lib/roles";

export const dynamic = "force-dynamic";

const norm = (v) => String(v || "").trim().toLowerCase();

// POST /api/reports/[serial]/sign-link — "Send to client for approval". Mints
// (or returns) the public, no-login link a client uses to review the report and
// either APPROVE + sign it or RETURN it with a comment. The report moves to
// PENDING_CLIENT. Staff only, and only once a manager has approved the report
// (status APPROVED) or the client previously returned it (CLIENT_RETURNED).
export async function POST(_req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  const report = await prisma.report.findUnique({ where: { serial: params.serial } });
  if (!report) return Response.json({ error: "Report not found." }, { status: 404 });
  if (!canView(report, user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  // Only a manager/admin, or one of the report's routed reviewers, may send it
  // to the client — never the author on their own.
  const roles = rolesOf(user);
  const isManager = roles.some((r) => [...MANAGER_ROLES, "ADMIN"].includes(r));
  const routed = [report.supervisorEmail, ...(report.supervisorEmails || [])].map(norm).includes(norm(user.email));
  if (!isManager && !routed) return Response.json({ error: "Only a manager can send a report to the client." }, { status: 403 });

  const sendable = ["APPROVED", "PENDING_CLIENT", "CLIENT_RETURNED"];
  if (!sendable.includes(report.status)) {
    return Response.json({ error: "The report must be approved by a manager before it can be sent to the client." }, { status: 400 });
  }

  let token = report.signToken;
  if (!token) token = crypto.randomBytes(18).toString("base64url");

  // Moving to PENDING_CLIENT (re)opens the external approval. If a client had
  // already signed, keep that record; a fresh send simply awaits a new decision.
  const wasPending = report.status === "PENDING_CLIENT";
  await prisma.report.update({
    where: { id: report.id },
    data: {
      signToken: token,
      status: "PENDING_CLIENT",
      ...(wasPending
        ? {}
        : { trailEvents: { create: [{ action: "SENT TO CLIENT", byName: user.name, byUserId: user.sub || null }] } }),
    },
  });

  return Response.json({
    ok: true,
    token,
    path: `/sign/report/${token}`,
    status: "PENDING_CLIENT",
    signed: !!report.clientSignatureImage,
    signedByName: report.clientSignedByName || null,
    signedAt: report.clientSignedAt || null,
  });
}
