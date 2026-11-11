import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { ReportDocument } from "@/pdf/ReportDocument";
import { logoDataUrl } from "@/lib/logo";
import { qrDataUrl, verifyUrl } from "@/lib/qr";
import { syncCompany } from "@/lib/settings";
import { appendPdfPages } from "@/lib/pdfMerge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/public/reports/[token]/pdf — the report as a PDF for the public
// signing page. No login: the token is the capability. Renders the client-facing
// document (no internal-only extras).
export async function GET(_req, { params }) {
  const report = await prisma.report.findUnique({
    where: { signToken: params.token },
    include: {
      photos: { orderBy: { order: "asc" } },
      attachments: { orderBy: { order: "asc" } },
      trailEvents: { orderBy: { at: "asc" } },
    },
  });
  if (!report || !["PENDING_CLIENT", "APPROVED", "CLIENT_RETURNED"].includes(report.status)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const qrText = [
    `QSL ${report.templateName}`,
    `${report.serial} · ${report.clientName}${report.site ? " - " + report.site : ""}`,
    `Status: ${String(report.status || "").replace(/_/g, " ").toLowerCase()}`,
    `Filed by ${report.authorName}`,
    verifyUrl(`/reports/${report.serial}`),
  ].join("\n");
  const qrSrc = await qrDataUrl(qrText);
  await syncCompany();
  let buffer = await renderToBuffer(
    React.createElement(ReportDocument, { report, logoSrc: logoDataUrl(), qrSrc })
  );
  if (report.attachments && report.attachments.length) {
    buffer = await appendPdfPages(buffer, report.attachments, { serial: report.serial });
  }

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${report.serial}.pdf"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
