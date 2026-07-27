import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/auth";
import { canGenerateReports, rolesOf } from "@/lib/roles";
import { buildManagementReport } from "@/lib/managementReport";
import { ManagementReportDocument } from "@/pdf/ManagementReportDocument";
import { logoDataUrl } from "@/lib/logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/reports/summary/pdf?from=&to= — the management report as a branded PDF.
export async function GET(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canGenerateReports(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();

  const data = await buildManagementReport(user, { from, to });
  const buffer = await renderToBuffer(
    React.createElement(ManagementReportDocument, {
      data,
      logoSrc: logoDataUrl(),
      generatedByName: user.name || user.email,
      generatedByRole: (rolesOf(user)[0] || "").replace(/_/g, " "),
    })
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="QSL-management-report-${stamp}.pdf"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
