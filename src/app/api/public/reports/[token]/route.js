import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/public/reports/[token] — minimal report info for the public signing
// page. No login: the unguessable token is the capability.
export async function GET(_req, { params }) {
  const report = await prisma.report.findUnique({
    where: { signToken: params.token },
    select: {
      serial: true, templateName: true, clientName: true, site: true,
      authorName: true, reportDate: true, createdAt: true, status: true,
      clientSignatureImage: true, clientSignedByName: true, clientSignedAt: true,
    },
  });
  // The link is live while the report is out for client approval (PENDING_CLIENT)
  // and remains viewable once it has been approved & signed (APPROVED). A
  // returned report (CLIENT_RETURNED) is no longer actionable by the client.
  const live = report && ["PENDING_CLIENT", "APPROVED", "CLIENT_RETURNED"].includes(report.status);
  if (!live) {
    return Response.json({ error: "This link is not valid." }, { status: 404 });
  }
  return Response.json({
    serial: report.serial,
    templateName: report.templateName,
    clientName: report.clientName,
    site: report.site,
    authorName: report.authorName,
    date: report.reportDate || report.createdAt,
    status: report.status,
    signed: !!report.clientSignatureImage,
    returned: report.status === "CLIENT_RETURNED",
    signedByName: report.clientSignedByName || null,
    signedAt: report.clientSignedAt || null,
  });
}
