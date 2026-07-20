import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canView } from "@/lib/rbac";
import { ReportDocument } from "@/pdf/ReportDocument";
import { logoDataUrl } from "@/lib/logo";
import { qrDataUrl, verifyUrl } from "@/lib/qr";

// Force Node.js runtime — @react-pdf/renderer cannot run on the edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }

  const report = await prisma.report.findUnique({
    where: { serial: params.serial },
    include: {
      photos: { orderBy: { order: "asc" } },
      trailEvents: { orderBy: { at: "asc" } },
    },
  });
  if (!report) return Response.json({ error: "Report not found." }, { status: 404 });
  if (!canView(report, user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const qrSrc = await qrDataUrl(verifyUrl(`/reports/${report.serial}`));
  const buffer = await renderToBuffer(
    React.createElement(ReportDocument, { report, logoSrc: logoDataUrl(), qrSrc })
  );

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${report.serial}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
