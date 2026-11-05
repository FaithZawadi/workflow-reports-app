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
  if (!report || report.status !== "APPROVED") {
    return Response.json({ error: "This signing link is not valid." }, { status: 404 });
  }
  return Response.json({
    serial: report.serial,
    templateName: report.templateName,
    clientName: report.clientName,
    site: report.site,
    authorName: report.authorName,
    date: report.reportDate || report.createdAt,
    signed: !!report.clientSignatureImage,
    signedByName: report.clientSignedByName || null,
    signedAt: report.clientSignedAt || null,
  });
}
