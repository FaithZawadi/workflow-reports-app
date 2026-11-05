import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canView } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// POST /api/reports/[serial]/sign-link — mint (or return) the public, no-login
// link a client uses to review and sign this report externally. Staff only, and
// only once the report is fully approved. The signed copy stays in the app.
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
  if (report.status !== "APPROVED") {
    return Response.json({ error: "The report must be fully approved before it can be sent for client signature." }, { status: 400 });
  }

  let token = report.signToken;
  if (!token) {
    token = crypto.randomBytes(18).toString("base64url");
    await prisma.report.update({ where: { id: report.id }, data: { signToken: token } });
  }
  return Response.json({
    ok: true,
    token,
    path: `/sign/report/${token}`,
    signed: !!report.clientSignatureImage,
    signedByName: report.clientSignedByName || null,
    signedAt: report.clientSignedAt || null,
  });
}
